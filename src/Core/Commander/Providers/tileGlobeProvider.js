/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

/*
 * A Faire
 * Les tuiles de longitude identique ont le maillage et ne demande pas 1 seule calcul pour la génération du maillage
 * 
 * 
 * 
 * 
 */



/* global THREE */

define('Core/Commander/Providers/tileGlobeProvider',[                        
            'Core/Geographic/Projection',
            'Core/Commander/Providers/WMTS_Provider',
            'Globe/EllipsoidTileGeometry',
            'Core/Geographic/CoordWMTS',
            'Core/Math/Ellipsoid',
            'Core/defaultValue',
            'Scene/BoudingBox'                        
            ],
             function(
                Projection,
                WMTS_Provider,
                EllipsoidTileGeometry,
                CoordWMTS,
                Ellipsoid,
                defaultValue,
                BoudingBox
                ){
                   
    function tileGlobeProvider(size){
        //Constructor
       
       this.projection      = new Projection();
       this.providerWMTS    = new WMTS_Provider();       
       this.ellipsoid       = new Ellipsoid(size);       
       this.cacheGeometry   = [];
       this.tree            = null;
               
    }        

    tileGlobeProvider.prototype.constructor = tileGlobeProvider;
    
    tileGlobeProvider.prototype.getGeometry = function(bbox,cooWMTS)
    {
        var geoCach   = undefined;
        var n         = Math.pow(2,cooWMTS.zoom+1);       
        var part      = Math.PI * 2.0 / n;
        
        if(this.cacheGeometry[cooWMTS.zoom] !== undefined && this.cacheGeometry[cooWMTS.zoom][cooWMTS.row] !== undefined)
        {            
                geoCach = this.cacheGeometry[cooWMTS.zoom][cooWMTS.row];                
        }
        else
        {
            if(this.cacheGeometry[cooWMTS.zoom] === undefined)
                this.cacheGeometry[cooWMTS.zoom] = new Array() ;
           
            var precision   = 32;
        
            if(this.level > 11)
                precision   = 64;
            else if(this.level > 8)
                precision   = 32;
            else if (this.level > 6)
                precision   = 32;
                                    
            var rootBBox    = new BoudingBox(0,part+part*0.01,bbox.minCarto.latitude, bbox.maxCarto.latitude );
            
            geoCach   = new EllipsoidTileGeometry(rootBBox,precision,this.ellipsoid,cooWMTS.zoom);
            this.cacheGeometry[cooWMTS.zoom][cooWMTS.row] = geoCach;    
                
        }
        
        return geoCach;
    };
    
    tileGlobeProvider.prototype.get = function(command)
    {  
        var bbox    = command.paramsFunction[0];
        var cooWMTS = this.projection.WGS84toWMTS(bbox);                
        var parent  = command.requester;        
        var geoCach = undefined; //getGeometry(bbox,cooWMTS);       
        var tile    = new command.type(bbox,cooWMTS,this.ellipsoid,parent/*,geoCach*/);
        
        if(geoCach)
        {
            tile.rotation.set ( 0, (cooWMTS.col%2)* (Math.PI * 2.0 / Math.pow(2,cooWMTS.zoom+1)), 0 );
            tile.updateMatrixWorld();
        }
        
        var translate   = new THREE.Vector3();
             
        if(parent.worldToLocal !== undefined )                
            translate = parent.worldToLocal(tile.absoluteCenter.clone());
           
        
        tile.position.copy(translate);
        
        
        tile.visible = false;
        
        parent.add(tile);
                        
        return this.providerWMTS.getTextureBil(cooWMTS).then(function(terrain)
        {                                      
            this.setTerrain(terrain);
            
            return this;

        }.bind(tile)).then(function(tile)
        {                      
            if(cooWMTS.zoom >= 2)
                
                this.getOrthoImages(tile);
 
            else
                            
               tile.checkOrtho();
                           
        }.bind(this)); 
    };
    
    tileGlobeProvider.prototype.getOrthoImages = function(tile)
    {         
        var box        = this.projection.WMTS_WGS84ToWMTS_PM(tile.cooWMTS,tile.bbox); // 
        var id         = 0;
        var col        = box[0].col;                
        tile.orthoNeed = box[1].row + 1 - box[0].row;

        for (var row = box[0].row; row < box[1].row + 1; row++)
        {                                                                        
            this.providerWMTS.getTextureOrtho(new CoordWMTS(box[0].zoom,row,col),id).then
            (
                function(result)
                {                                                                                  
                    this.setTextureOrtho(result.texture,result.id);                                                     

                }.bind(tile)
            );

            id++;
        }  
        
    };
                          
    return tileGlobeProvider;                
                 
});