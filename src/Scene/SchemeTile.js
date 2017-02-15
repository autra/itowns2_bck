/**
 * Generated On: 2015-10-5
 * Class: SchemeTile
 * Description: Cette classe décrit un découpage spatiale.
 */


import BoundingBox from 'Scene/BoundingBox';

function SchemeTile() {
    // Constructor

    this.maximumChildren = 4;
    this.schemeBB = [];
}
/**
 *
 * @param {type} minLo
 * @param {type} maxLo
 * @param {type} minLa
 * @param {type} maxLa
 * @returns {SchemeTile_L8.SchemeTile.prototype@pro;schemeBB@call;push}
 */

SchemeTile.prototype.add = function add(minLo, maxLo, minLa, maxLa, unit) {
    return this.schemeBB.push(new BoundingBox(minLo, maxLo, minLa, maxLa, 0, 0, unit));
};


SchemeTile.prototype.rootCount = function rootCount() {
    return this.schemeBB.length;
};

SchemeTile.prototype.getRoot = function getRoot(id) {
    return this.schemeBB[id];
};


export default SchemeTile;
