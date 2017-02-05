// Copyright 2016 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

const Feature = require('components/feature_manager/feature.js');
const ObjectGroup = require('entities/object_group.js');
const ObjectRemover = require('features/player_favours/object_remover.js');
const ScopedEntities = require('entities/scoped_entities.js');

// Implementation of a collection of features that have been implemented specifically by request of
// a particular player. The actual features and their owners are documented in the README.md file.
class PlayerFavours extends Feature {
    constructor() {
        super();

        this.objectRemover_ = new ObjectRemover();
        this.objectRemover_.load('data/favours/caligula_basement_door.json'); // Door which blocks access to basement in caligulas

        this.objectGroups_ = [];

        // -----------------------------------------------------------------------------------------
        // Russell (https://sa-mp.nl/players/52872/russell.html)

        this.objectRemover_.load('data/favours/russell_house_removals.json');
        this.objectGroups_.push(ObjectGroup.create('data/favours/russell_house_objects.json', 0, 0));

	    // -----------------------------------------------------------------------------------------
        // Jasmine (https://forum.sa-mp.nl/thread-33720.html)

        this.objectRemover_.load('data/favours/jasmine_house_tower.json');
        this.objectGroups_.push(ObjectGroup.create('data/favours/jasmine_house_tower.json', 0, 0));

        // -----------------------------------------------------------------------------------------
        // Joe (https://sa-mp.nl/players/30/joe.html)

        this.objectRemover_.load('data/favours/joe_house_removals.json');
        this.objectGroups_.push(ObjectGroup.create('data/favours/joe_house_objects.json', 0, 0));

        // -----------------------------------------------------------------------------------------
        // Houdini (https://forum.sa-mp.nl/user-19296.html)

        this.objectGroups_.push(ObjectGroup.create('data/favours/houdini_house_tower.json', 0, 0));

        // -----------------------------------------------------------------------------------------
        // Huracan (https://sa-mp.nl/players/120307/huracan.html)

        this.huracanActors_ = new ScopedEntities();
        this.huracanActors_.createActor({
            modelId: 287,
            position: new Vector(1122.71, -2033.97, 69.89),
            rotation: 270
        });

        this.huracanActors_.createActor({
            modelId: 287,
            position: new Vector(1122.71, -2040.10, 69.89),
            rotation: 270
        });

        this.huracanActors_.createActor({
            modelId: 116,
            position: new Vector(1117.91, -2037.05, 78.75),
            rotation: 270
        });

        // -----------------------------------------------------------------------------------------
        // [ER]Luka (https://sa-mp.nl/players/123358/er-luka.html) and
        // ToxicCookie (https://sa-mp.nl/players/119454/toxiccookie.html)

        this.lukaAndToxicccokieActors_ = new ScopedEntities();
        this.lukaAndToxicccokieActors_.createActor({
            modelId: 240,
            position: new Vector(-378.03, 2242.15, 46.09),
            rotation: 103
        });

        this.lukaAndToxicccokieActors_.createActor({
            modelId: 106,
            position: new Vector(-384.11, 2206.16, 45.67),
            rotation: 276
        });

        // -----------------------------------------------------------------------------------------
        // Xanland (https://sa-mp.nl/players/423/xanland.html)

        //this.objectRemover_.load('data/favours/xanland_lvairport_entrance.json');
        //this.addXanlandObject_();

        //server.commandManager.buildCommand('xanlandobject')
        //    .build(PlayerFavours.prototype.onXanlandObjectCommand.bind(this));
        // -----------------------------------------------------------------------------------------
    }

    onXanlandObjectCommand(player) {
        if (this.isXanlandObjectAdded_) {
            this.removeXanlandObject_();
            player.sendMessage('Done, removed!');
        } else {
            this.addXanlandObject_();
            player.sendMessage('Done, added!');
        }
    }

    addXanlandObject_() {
        this.xanlandObject_ = ObjectGroup.create('data/favours/xanland_lvairport_entrance.json', 0, 0);
        this.isXanlandObjectAdded_ = true;
    }

    removeXanlandObject_() {
        this.xanlandObject_.dispose();
        this.xanlandObject_ = null;
        this.isXanlandObjectAdded_ = false;
    }

    // This feature has no public API.

    dispose() {
        this.huracanActors_.dispose();
        this.huracanActors_ = null;

        this.lukaAndToxicccokieActors_.dispose();
        this.lukaAndToxicccokieActors_ = null;

        for (const objectGroup of this.objectGroups_)
            objectGroup.dispose();

        this.objectGroups_ = null;

        this.objectRemover_.dispose();
        this.objectRemover_ = null;

        //this.removeXanlandObject_();
        //server.commandManager.removeCommand('xanlandobject');
    }
}

exports = PlayerFavours;
