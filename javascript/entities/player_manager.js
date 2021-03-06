// Copyright 2016 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

import ScopedCallbacks from 'base/scoped_callbacks.js';

const VEHICLE_ENTER_EXIT = 16;  // also KEY_SECONDARY_ATTACK

// The player manager keeps track of all players connected to Las Venturas Playground. Features may
// choose to observe the manager in order to receive notifications when someone connects or
// disconnects from the server. Non-player characters are treated identical to players.
class PlayerManager {
    constructor(playerConstructor = Player) {
        this.playerConstructor_ = playerConstructor;
        this.players_ = new Map();

        this.observers_ = new Set();

        this.callbacks_ = new ScopedCallbacks();
        this.callbacks_.addEventListener(
            'playerconnect', PlayerManager.prototype.onPlayerConnect.bind(this));
        this.callbacks_.addEventListener(
            'playerkeystatechange', PlayerManager.prototype.onPlayerKeyStateChange.bind(this));
        this.callbacks_.addEventListener(
            'playerlevelchange', PlayerManager.prototype.onPlayerLevelChange.bind(this));
        this.callbacks_.addEventListener(
            'playerlogin', PlayerManager.prototype.onPlayerLogin.bind(this));
        this.callbacks_.addEventListener(
            'playerstatechange', PlayerManager.prototype.onPlayerStateChange.bind(this));
        this.callbacks_.addEventListener(
            'playerdisconnect', PlayerManager.prototype.onPlayerDisconnect.bind(this));
        this.callbacks_.addEventListener(
            'playerguestlogin', PlayerManager.prototype.onPlayerGuestLogin.bind(this));

        // Implementation of the UpdatePlayerSyncedData() Pawn native.
        provideNative('UpdatePlayerSyncedData', 'iiifs',
                      PlayerManager.prototype.updatePlayerSyncedData.bind(this))
    }

    // Gets the number of players currently connected to the server.
    get count() { return this.players_.size; }

    // Returns the player whose Id is |playerId|, or NULL when they are not connected.
    getById(playerId) {
        if (!this.players_.has(playerId))
            return null;

        return this.players_.get(playerId);
    }

    // Returns the player whose name is |name|, optionally |fuzzy| when set. NULL will be returned
    // when there is no player with the |name|, or when a |fuzzy| match is requested and multiple
    // players match the |name|. (In which case you'd want to use findPlayers().)
    getByName(name, fuzzy = false) {
        if (fuzzy) {
            let matches = [];

            const lowerCaseName = name.toLowerCase();
            for (const player of this.players_.values()) {
                if (player.name.toLowerCase().includes(lowerCaseName))
                    matches.push(player);
            }

            if (matches.length == 1)
                return matches[0];

            return null;
        }

        for (const player of this.players_.values()) {
            if (player.name === name)
                return player;
        }

        return null;
    }

    // Finds one or more players that match the constraints given in the named parameters. Returns
    // an array of players by default, or a Player instance when |returnPlayer| is set to true. In
    // both cases NULL will be returned when no player has been selected.
    find({ nameOrId = null, returnPlayer = false } = {}) {
        // TODO(Russell): Implement this method properly.

        const playerId = parseInt(nameOrId, 10 /* base */);
        if (!Number.isNaN(playerId) && this.players_.has(playerId))
            return this.players_.get(playerId);

        return this.getByName(nameOrId, true /* fuzzy */);
    }

    // Executes the |callback| once for each player connected to the server. The first argument to
    // the |callback| will be the Player object, the second the player's ID.
    forEach(callback, thisArg = null) {
        for (const player of this.players_.values())
            callback.call(thisArg, player, player.id);
    }

    // Observes players connecting and disconnecting from the server. The |observer| will receive
    // calls to the following methods: onPlayerConnect, onPlayerDisconnect. When the |replayHistory|
    // option has been set, events for existing players will be replayed to the observer.
    addObserver(observer, replayHistory = false) {
        if (this.observers_.has(observer))
            return;

        this.observers_.add(observer);

        if (!replayHistory)
            return;

        for (const player of this.players_.values()) {
            if ('onPlayerConnect' in observer)
                observer.onPlayerConnect(player);

            if ('onPlayerLogin' in observer && player.isRegistered())
                observer.onPlayerLogin(player, {});
        }
    }

    // Removes |observer| from the set of objects that will be informed about players connecting
    // and disconnecting from the server.
    removeObserver(observer) {
        this.observers_.delete(observer);
    }

    // Called when a player has connected to Las Venturas Playground. The |event| may potentially
    // contain untrusted or incorrect data that has to be verified.
    onPlayerConnect(event) {
        const playerId = event.playerid;

        if (this.players_.has(playerId)) {
            console.log('[PlayerManager] Warning: A player with Id ' + playerId + ' is already ' +
                        'connected to the server.');
            return;
        }

        // Pass the |event| as it may contain additional meta-data when used by tests.
        const player = new this.playerConstructor_(playerId, event);

        // Associate the |player| instance with the |playerId|.
        this.players_.set(playerId, player);

        // Notify the observers of the |player|'s connection.
        this.notifyObservers('onPlayerConnect', player);
    }

    // Called when a player changes the keys they're pressing. Which is frequent.
    onPlayerKeyStateChange(event) {
        const player = this.players_.get(event.playerid);
        if (!player)
            return;  // the event has been received for an invalid player

        const newkeys = event.newkeys;
        const oldkeys = event.oldkeys;

        // Called when the |player| requests to enter or exit a vehicle. Special handling is
        // required when the player is in or near a remote controllable vehicle.
        if ((newkeys & VEHICLE_ENTER_EXIT) === VEHICLE_ENTER_EXIT)
            server.vehicleManager.onPlayerVehicleEnterExit(player);
    }

    // Called when a player's level on the server changes, for example because they log in to their
    // account, they get temporary rights or take their own rights away.
    onPlayerLevelChange(event) {
        const player = this.players_.get(event.playerid);
        if (!player)
            return;  // the event has been received for an invalid player

        switch (event.newlevel) {
            case 3:  // Management
                player.level_ = Player.LEVEL_MANAGEMENT;
                break;
            case 2:  // Administrator
                player.level_ = Player.LEVEL_ADMINISTRATOR;
                break;
            default:
                player.level_ = Player.LEVEL_PLAYER;
                break;
        }

        this.notifyObservers('onPlayerLevelChange', player);
    }

    // Called when a player logs in to their account. This marks availability of their user data
    // and the fact that their identity has been verified.
    onPlayerLogin(event) {
        const player = this.players_.get(event.playerid);
        if (!player)
            return;  // the event has been received for an invalid player

        player.userId_ = event.userid;
        player.vip_ = !!event.vip;
        player.undercover_ = !!event.undercover;

        this.notifyObservers('onPlayerLogin', player, event);
    }

    // Called when a player decides to play as guest. This changes the name of the player so the
    // player-object needs to be updated to have the new name.
    onPlayerGuestLogin(event) {
        const player = this.players_.get(event.playerId);
        if (!player)
            return;  // the event has been received for an invalid player

        player.name_ = event.guestPlayerName;

        this.notifyObservers('onPlayerGuestLogin', player, event);
    }

    // Called when a player's state changes. Handles players entering and leaving vehicles, and
    // synchronizing this information with both the Player and Vehicle instances.
    onPlayerStateChange(event) {
        const player = this.players_.get(event.playerid);
        if (!player)
            return;  // the player isn't valid

        if (event.oldstate === Player.STATE_DRIVER || event.oldstate === Player.STATE_PASSENGER) {
            const vehicle = player.vehicle;
            if (!vehicle)
                return;  // the vehicle isn't managed by JavaScript

            this.notifyObservers('onPlayerLeaveVehicle', player, vehicle);

            vehicle.onPlayerLeaveVehicle(player);

            player.vehicle_ = null;
            player.vehicleSeat_ = null;
        }

        if (event.newstate === Player.STATE_DRIVER || event.newstate === Player.STATE_PASSENGER) {
            const vehicle = server.vehicleManager.getById(player.findVehicleId());
            if (!vehicle)
                return;  // the vehicle isn't managed by JavaScript

            player.vehicle_ = vehicle;
            player.vehicleSeat_ = player.findVehicleSeat();

            vehicle.onPlayerEnterVehicle(player);

            this.notifyObservers('onPlayerEnterVehicle', player, vehicle);
        }
    }

    // Called when a player has disconnected from Las Venturas Playground. The |event| may contain
    // untrusted or incorrect data that has to be verified.
    onPlayerDisconnect(event) {
        const player = this.players_.get(event.playerid);
        if (!player)
            return;  // the event has been received for an invalid player

        const reason = event.reason;

        // Notify the |player| instance of the fact that the associated player is disconnecting.
        player.notifyDisconnecting();

        // Remove the player from their vehicle if they're currently in one.
        if (player.vehicle !== null) {
            this.notifyObservers('onPlayerLeaveVehicle', player, player.vehicle);

            player.vehicle.onPlayerLeaveVehicle(player);

            player.vehicle_ = null;
            player.vehicleSeat_ = null;
        }

        // Remove knowledge of the |player| from the player manager.
        this.players_.delete(event.playerid);

        // Notify observers of the player manager of their disconnecting.
        this.notifyObservers('onPlayerDisconnect', player, reason);

        // And finally mark the player as having disconnected.
        player.notifyDisconnected();
    }

    // Called when a value of synchronized data associated with a player has changed.
    updatePlayerSyncedData(playerId, property, intValue, floatValue, stringValue) {
        const player = this.players_.get(playerId);
        if (!player)
            return;  // the event has been received for an invalid player

        player.syncedData.apply(property, intValue, floatValue, stringValue);
    }

    // Notifies observers about the |eventName|, passing |...args| as the argument to the method
    // when it exists. The call will be bound to the observer's instance.
    notifyObservers(eventName, ...args) {
        for (const observer of this.observers_) {
            let prototype = Object.getPrototypeOf(observer);

            // Iterate up the class hierarchy to find a parent having |eventName|.
            while (prototype && !prototype.hasOwnProperty(eventName))
                prototype = Object.getPrototypeOf(prototype);

            // If such a prototype has been found, call the |eventName| on it.
            if (prototype)
                prototype[eventName].call(observer, ...args);
        }
    }

    // Returns an iterator that can be used to iterate over the connected players.
    [Symbol.iterator]() { return this.players_.values(); }

    // Releases all references and state held by the player manager.
    dispose() {
        provideNative('UpdatePlayerSyncedData', 'iiifs', () => 1);

        this.callbacks_.dispose();
        this.callbacks_ = null;

        this.observers_ = null;
        this.players_ = null;
    }
}

export default PlayerManager;
