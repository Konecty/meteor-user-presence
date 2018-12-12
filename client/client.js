/* globals UserPresence */
import { debounce } from '../utils';
let timer, status;
const setUserPresence = debounce((newStatus) => {
	if (!UserPresence.connected || newStatus === status) {
		return
	}
	switch(status) {
		case 'online':
			Meteor.call('UserPresence:online', UserPresence.userId);
			UserPresence.startTimer();
			break;
		case 'away':
			Meteor.call('UserPresence:away', UserPresence.userId);
			UserPresence.stopTimer();
			break;
		default:
			return;
	}
	status = newStatus;

}, 5000);

UserPresence = {
	awayTime: 60000, // 1 minute
	awayOnWindowBlur: false,
	callbacks: [],
	connected: true,
	started: false,
	userId: null,

	/**
	 * The callback will receive the following parameters: user, status
	 */
	onSetUserStatus: function(callback) {
		this.callbacks.push(callback);
	},

	runCallbacks: function(user, status) {
		this.callbacks.forEach(function(callback) {
			callback.call(null, user, status);
		});
	},

	startTimer: function() {
		UserPresence.stopTimer();
		if (!UserPresence.awayTime) {
			return;
		}
		timer = setTimeout(UserPresence.setAway, UserPresence.awayTime);
	},
	stopTimer: function() {
		clearTimeout(timer);
	},
	restartTimer: function() {
		UserPresence.startTimer();
	},
	setAway: () => setUserPresence('away'),
	setOnline: () => setUserPresence('online'),
	start: function(userId) {
		// after first call remove function's body to be called once
		this.start = () => {};
		this.userId = userId;

		// register a tracker on connection status so we can setup the away timer again (on reconnect)
		Tracker.autorun(() => {
			const { connected } = Meteor.status();
			this.connected = connected;
			if (connected) {
				UserPresence.startTimer();
				status = 'online';
				return;
			}
			this.stopTimer();
			status = 'offline';
		});


		['mousemove', 'mousedown', 'touchend', 'keydown']
			.forEach(key => document.addEventListener(key, this.setOnline));

		window.addEventListener('focus', this.setOnline);

		if (this.awayOnWindowBlur === true) {
			window.addEventListener('blur', this.setAway);
		}

	}
};

Meteor.methods({
	'UserPresence:setDefaultStatus': function(status) {
		check(status, String);
		Meteor.users.update({_id: Meteor.userId()}, {$set: { status, statusDefault: status }});
	},
	'UserPresence:online': function() {
		const user = Meteor.user();
		if (user && user.status !== 'online' && user.statusDefault === 'online') {
			Meteor.users.update({_id: Meteor.userId()}, {$set: {status: 'online'}});
		}
		UserPresence.runCallbacks(user, 'online');
	},
	'UserPresence:away': function() {
		var user = Meteor.user();
		UserPresence.runCallbacks(user, 'away');
	}
});
