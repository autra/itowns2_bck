import Extent from '../Core/Geographic/Extent';
import { CancelledCommandException } from '../Core/Scheduler/Scheduler';

function subdivisionExtents(bbox) {
    const center = bbox.center();

    const northWest = new Extent(bbox.crs(),
        bbox.west(), center._values[0],
        center._values[1], bbox.north());
    const northEast = new Extent(bbox.crs(),
        center._values[0], bbox.east(),
        center._values[1], bbox.north());
    const southWest = new Extent(bbox.crs(),
        bbox.west(), center._values[0],
        bbox.south(), center._values[1]);
    const southEast = new Extent(bbox.crs(),
        center._values[0], bbox.east(),
        bbox.south(), center._values[1]);

    // scheme tiles store their coordinates in radians internally,
    // so we need to fix the new bboxes as well
    const result = [northWest, northEast, southWest, southEast];

    for (const r of result) {
        r._internalStorageUnit = bbox._internalStorageUnit;
    }
    return result;
}

function requestNewTile(view, scheduler, geometryLayer, extent, parent, level) {
    const command = {
        /* mandatory */
        view,
        requester: parent,
        layer: geometryLayer,
        priority: 10000,
        /* specific params */
        extent,
        level,
        redraw: false,
        threejsLayer: geometryLayer.threejsLayer,
    };

    return scheduler.execute(command).then((node) => {
        node.add(node.OBB());
        return node;
    });
}

function subdivideNode(context, layer, node, initNewNode) {
    if (!node.pendingSubdivision && !node.children.some(n => n.layer == layer.id)) {
        const extents = subdivisionExtents(node.extent);
        // TODO: pendingSubdivision mechanism is fragile, get rid of it
        node.pendingSubdivision = true;

        const promises = [];
        const children = [];
        for (const extent of extents) {
            promises.push(
                requestNewTile(context.view, context.scheduler, layer, extent, node).then((child) => {
                    children.push(child);
                    initNewNode(context, layer, node, child);
                    return node;
                }));
        }

        Promise.all(promises).then(() => {
            for (const child of children) {
                node.add(child);
                child.updateMatrixWorld(true);
                child.OBB().update();

                child.material.uniforms.lightPosition.value =
                    node.material.uniforms.lightPosition.value;
                child.material.uniforms.lightingEnabled.value =
                    node.material.uniforms.lightingEnabled.value;
            }
            // TODO
            /*
              if (child.material.elevationLayersId.length) {
                // need to force update elevation when delta is important
                if (child.level - child.material.getElevationLayerLevel() > 6) {
                    updateNodeElevation(_this.scene, params.tree, child, params.layersConfig, true);
                }
            }
            */
            node.pendingSubdivision = false;
            context.view.notifyChange(false, node);
        }, (err) => {
            node.pendingSubdivision = false;
            if (!(err instanceof CancelledCommandException)) {
                throw new Error(err);
            }
        });
    }
}

export function initTiledGeometryLayer(schemeTile) {
    const _promises = [];
    return function _initTiledGeometryLayer(context, layer) {
        if (_promises.length > 0) {
            return;
        }

        layer.level0Nodes = [];

        for (let i = 0; i < schemeTile.rootCount(); i++) {
            _promises.push(
                requestNewTile(context.view, context.scheduler, layer, schemeTile.getRoot(i), undefined, 0));
        }
        Promise.all(_promises).then((level0s) => {
            layer.level0Nodes = level0s;
            for (const level0 of level0s) {
                // TODO: support a layer.root attribute, to be able
                // to add a layer to a three.js node, e.g:
                // layer.root.add(level0);
                context.view.scene.add(level0);
                level0.updateMatrixWorld();
            }
        });
    };
}

export function processTiledGeometryNode(cullingTest, subdivisionTest, initNewNode) {
    return function _processTiledGeometryNode(context, layer, node) {
    // early exit if parent' subdivision is in progress
        if (node.parent.pendingSubdivision) {
            node.visible = false;
            node.setDisplayed(false);
            return undefined;
        }

        // do proper culling
        const isVisible = cullingTest ? (!cullingTest(node, context.camera)) : true;
        node.visible = isVisible;

        if (isVisible) {
            let requestChildrenUpdate = false;

            if (node.pendingSubdivision || subdivisionTest(context, layer, node)) {
                subdivideNode(context, layer, node, initNewNode);
                // display iff children aren't ready
                node.setDisplayed(node.pendingSubdivision);
                requestChildrenUpdate = true;
            } else {
                node.setDisplayed(true);
            }

            if (node.material.visible) {
                // update uniforms
                node.setFog(1000000000);

                if (!requestChildrenUpdate) {
                    node.removeChildren();
                }
            }

            // TODO: use Array.slice()
            return requestChildrenUpdate ? node.children.filter(n => n.layer == layer.id) : undefined;
        }

        node.setDisplayed(false);
        node.removeChildren();

        return undefined;
    };
}
