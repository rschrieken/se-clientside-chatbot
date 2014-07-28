/*global $:false, fkey:false, window:false, WebSocket:false, console:false, document:false, CHAT:false */
(function () {
    "use strict";
    var room = parseInt(/http:\/\/(\w+\.)*\w+\/rooms\/(\S+?)(\/|$)/.exec(document.location.href)[2], 10),
		thisuser = CHAT.user.current().id,
		msg = [],
		silent = true,
		states = [],
		ownmsg = [Date.now()];

    function getRandomArbitrary(min, max) {
        return Math.random() * (max - min) + min;
    }

	function seconds(s) {
		return s * 1000;
	}

	function minutes(m) {
		return seconds(60) * m;
	}

	/* put a chatmessage on the queue*/
    function send(txt) {
	    msg.push(txt);
    }

	/* put a chatmessage on the queue after given seconds */
	function sendDelayed(txt, after) {
		var low = seconds(after), high = low + (low / 2);
		window.setTimeout(function () { send(txt); }, getRandomArbitrary(low, high));
	}

	 /* these commands are for the owner that runs them*/
	function handleCommands(ce) {
		if (ce.content === '!!time') {
			send(new Date().toString());
		}
		if (ce.content === '!!stop') {
			send('...');
			silent = true;
		}
		if (ce.content === '!!go') {
			silent = false;
		}
	}

	/* these are state machines for responding to message targetting the bot*/
	/* the all should return an object with a member next that is function that takes a chatevent */

	/*detect a Train... */
	function TrainState() {
	    var last, lastcnt = 0;
		return {
			next: function (ce) {
			    if (ce.event_type === 1) {
					if (last !== ce.content) {
						last = ce.content;
						lastcnt = 0;
					} else {
						if (lastcnt !== 3) {
							lastcnt = lastcnt + 1;
						} else {
							send(last);
						}
					}
					return true;
				} else {
					return false;
				}
		    }
		};
	}

	/*detect starring a message */
	function StarResponse() {
		var seen = [], idx, idxzero;
		return {
			next: function (ce) {
				if (ce.event_type === 6) {
					idx = seen.indexOf(ce.message_id);
					if (idx < 0) {
						send('Not everything is star-worthy...');
						idxzero = seen.indexOf(0);
						if (idxzero > -1) {
							seen[idxzero] = ce.message_id;
						} else {
							seen.push(ce.message_id);
						}
					} else {
						send('Stars get removed under peer-pressure?');
						seen[idx] = 0;
					}
					return true;
				} else {
					return false;
				}
			}
		};
	}

	/* offer coffee */
	function Coffee() {
	    var last, exhausted = false, state = 1;
		return {
			next: function (ce) {
				if ((ce.event_type === 1) && (ce.content === '!!coffee')) {
					switch (state) {
					case 1:
						send('418 I\'m a TEAPOT');
						last = Date.now();
						state = 2;
						break;
					case 2:
						if ((Date.now() - last) < minutes(1)) {
							send('406 Not Acceptable');
							state = 3;
						} else {
							state = 4;
						}
						break;
					case 3:
						if ((Date.now() - last) < minutes(2)) {
							send('Too much coffee is bad....');
						} else {
							state = 4;
						}
						break;
					case 4:
						send('Refilling...');
						window.setTimeout(function () { state = 1; }, seconds(10));
						state = 5;
						break;
					default:
						break;
					}
					return true;
				} else {
					return false;
				}
			}
		};
	}

	/* offer cupcakes */
	function Cupcake() {
	    var last, exhausted = false;
		return {
			next: function (ce) {
				if (ce.event_type === 1 &&
						ce.content === '!!cupcake') {
					if (typeof last !== 'number') {
						send('One cupcake on it\'s way');
						sendDelayed('One cupcake for @' + ce.user_name, 25);
						last = Date.now();
					} else {
						if (((Date.now() - last) < minutes(1))) {
							if (!exhausted) {
								send('Out of dough...');
								exhausted = true;
							} else {
								send('Don\'t hammer me...');
							}
						} else {
							send('new cupcakes can be ordered...');
							exhausted = false;
							last = undefined;
						}
					}
					return true;
				} else {
					return false;
				}
			}
		};
	}

	/* shutdown for Shadow Wizard */
	function Shutdown() {
		var going = false;
		return {
			next: function (ce) {
				if (ce.event_type === 1 &&
						ce.content === '!!SHU' &&
						ce.user_name.toLowerCase().contains('wizard') &&
						!going) {
					send('No, @' + ce.user_name + ' that only works on NOVELL NETWARE');
					going = true;
					window.setTimeout(function () { going = false; }, minutes(1));
					return true;
				} else {
					return false;
				}
			}
		};
	}
	
	function Wut() {
		var i = 0;
		return {
			next: function(ce) {
				if (ce.event_type === 1) {
					switch (i) {
						case 0:
							send('WUT?');
							break;
				         	case 1:
							send('What are you talking about?');
							i = 0;
							break;
					}
				}
			}
		}
	}

	/* register all statemachines */
	states.push(new TrainState());
	states.push(new StarResponse());
	states.push(new Coffee());
	states.push(new Cupcake());
	states.push(new Shutdown());
	states.push(new Wut());

	function handleEvent(ce) {
		var i;
		if (ce.user_id === thisuser) {
			handleCommands(ce);
		} else {
			var commandExecuted = false;
			var length = states.length;
			for (i = 0; i < length - 1; i = i + 1) {
				commandExecuted |= states[i].next(ce);
			}
			if (!commandExecuted) {
				states[length - 1].next(ce);
			}
		}
	}

	function handleEvents(ce) {
	    var i;
		for (i = 0; i < ce.length; i = i + 1) {
			handleEvent(ce[i]);
		}
	}

	/* generate messages, needs work... */
	function SentenceGenerator() {
	    var sentence = [], lastone, handler;
		sentence.push('By the end of the day I hope I\'m done');
		sentence.push('mirror/rorrim');
		sentence.push('In my timezone it is ' + new Date().toString());

		handler = function () {
			lastone = sentence.pop();
			if (lastone !== undefined) {
				send(lastone);
				window.setTimeout(
					handler,
					getRandomArbitrary(minutes(10), minutes(45))
				);
			} else {
				console.log('sentences done...');
			}
		};

		window.setTimeout(handler, getRandomArbitrary(minutes(10), minutes(45)));
	}

	/* get going with all of it */
    function init() {
	    var sg, throttle = seconds(2);
		// get a time marker by getting the latest message
        $.post('/chats/' +  room.toString() + '/events', {
            since: 0,
            mode: 'Messages',
            msgCount: 1,
            fkey: fkey().fkey
        }).success(function (eve) {
            console.log(eve.time);
			// call ws-auth to get the websocket url
            $.post('/ws-auth', { roomid: room, fkey: fkey().fkey }).success(function (au) {
                console.log(au);
				// start the webscoket
                var ws = new WebSocket(au.url + '?l=' + eve.time.toString());
                ws.onmessage = function (e) {
					// you get alle messages for all rooms you're in
					// make sure we only respond to message this bot is running in
				    var fld = 'r' + room.toString(), roomevent = JSON.parse(e.data)[fld], ce;
					if (roomevent && roomevent.e) {
					    ce = roomevent.e;
						// for throttling gather enough datapoints
						if (ce.user_id === thisuser) {
							if (ownmsg.length > 100) {
								ownmsg.shift();
							}
							ownmsg.push(Date.now());
						}
						console.log(ce);
						handleEvents(ce);
					}
				};
                ws.onerror = function (e) { console.log(e); };
            });
        });

		//sg = new SentenceGenerator();

		/* post a message and back-off if a 409 is received */
		function realsend(txt) {
			if (silent) {
				console.log(txt);
			} else {
				$.post('/chats/' + room.toString() + '/messages/new',
					{text: txt, fkey : fkey().fkey }).fail(
					function (jqxhr) {
						if (jqxhr.status === 409) {
							//conflict, aka throttled
							throttle = throttle + Math.round(throttle / 2);
							console.log(throttle);
							send(txt);
						}
					}
				).success(function () {
					if (throttle > seconds(2)) {
						throttle = throttle - Math.round(throttle / 4);
						if (throttle < seconds(2)) {
							throttle = seconds(2);
						}
					}
				});
			}
		}

		// this sends out chatmessage while we are within the rate-limits
		window.setInterval(function () {
			var txt, rate;
			// do some curve fitting here, but for now...
			if (ownmsg[ownmsg.length - 1] < (Date.now() - throttle)) {
				txt = msg.shift();
				if (txt !== undefined) {
					realsend(txt);
				}
			} else {
				console.log('throtled:' + ownmsg[ownmsg.length - 1].toString());
			}
		}, seconds(2));
    }

    init();
}());
