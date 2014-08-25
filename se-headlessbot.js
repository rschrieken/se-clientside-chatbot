/*global $:false, fkey:false, window:false, WebSocket:false, console:false, document:false, CHAT:false */
(function (remotestates) {
    "use strict";
    var room = parseInt(/http:\/\/(\w+\.)*\w+\/rooms\/(\S+?)(\/|$)/.exec(document.location.href)[2], 10),
        thisuser = CHAT.user.current().id,
		roomOwners = [],
		seenUsers = [],
        msg = [],
        silent = true,
        ownmsg = [Date.now()],
        unk,
		states = remotestates || [],
		prep = '~ ',
		started = Date.now();

    function getRandomArbitrary(min, max) {
        return Math.random() * (max - min) + min;
    }

    function seconds(s) {
        return s * 1000;
    }

    function minutes(m) {
        return seconds(60) * m;
    }

    /* put a chatmessage on the queue, either direct or after certain time*/
	/* txt = text to send
	   sorm = seconds if s is not given
	        = munutes if s is given
		s   = seconds
	*/
    function send(txt, sorm, s) {
	    var time;
	    if (s === undefined && sorm === undefined) {
			msg.push(txt);
		} else {
			if (s === undefined) {
				time = seconds(sorm);
			} else {
				time = minutes(sorm) + seconds(s);
			}
			window.setTimeout(function () { msg.push(txt); }, getRandomArbitrary(time, time + (time / 2)));
		}
    }

     /* these commands are for the owner that runs them*/
    function handleCommands(ce) {
	    var handled = false;
        if (ce.content === '!!time') {
            send(new Date().toString());
			handled = true;
        }
        if (ce.content === '!!stop') {
            send('...');
            silent = true;
			handled = true;
        }
        if (ce.content === '!!go') {
            silent = false;
			handled = true;
        }
		return handled;
    }

    /* these are state machines for responding to message targetting the bot*/
    /* the all should return an object with a member next that is function that takes a chatevent */

    /*detect a Train... */
    function TrainState() {
        var last, lastcnt = 0;
        return {
		    events: [1],
            next: function (ce) {
				if (last !== ce.content) {
					last = ce.content;
					lastcnt = 0;
				} else {
					lastcnt = lastcnt + 1;
					if (lastcnt === 3) {
						send(last);
					}
				}
            }
        };
    }

    /*detect starring a message */
	/* star and unstar is the same event
	   so it toggles for a certain message and certain user
	*/
    function StarResponse() {
        var seen = [], backoffFirst = false, backoffSecond = false;
        return {
		    events: [6],
            next: function (ce) {
				var idx = seen[ce.message_id];
				if (idx === undefined) {
					if (!backoffFirst) {
						send('Not everything is star-worthy...');
						backoffFirst = true;
						window.setTimeout(function () { backoffFirst = false; }, minutes(60));
					}

					seen[ce.message_id] = [];
					seen[ce.message_id][ce.user_id] = true;

				} else {
					if (idx[ce.user_id] === true) {
						idx[ce.user_id]	= false;
						if (!backoffSecond) {
							send('Stars get removed under peer-pressure?');
							backoffSecond = true;
							window.setTimeout(function () { backoffSecond = false; }, minutes(60));
						}
					} else {
						seen[ce.message_id][ce.user_id] = true;
					}
				}
			}
        };
    }

    /* offer coffee */
    function Coffee() {
        var  state = 1, timeout;

		function reset(toState, time) {
			if (timeout !== undefined) {
				window.clearTimeout(timeout);
			}
			timeout = window.setTimeout(function () { state = toState; }, time);
		}

        return {
		    command : '!!coffee',
			events: [1],
            next: function () {
				switch (state) {
				case 1:
					send('418 I\'m a TEAPOT');
					reset(3, minutes(1));
					state = 2;
					break;
				case 2:
					send('406 Not Acceptable');
					state = 3;
					reset(4, minutes(10));
					break;
				case 3:
					send('Too much coffee is bad....');
			        reset(4, minutes(5));
					state = 6;
					break;
				case 4:
					send('Refilling...');
					reset(1, seconds(10));
					state = 6;
					break;
				default:
					break;
				}
            }
        };
    }

	/* offer Milk */
    function Milk() {
        var cmd = '!!milk', last, state = 1;
        return {
		    command: cmd,
			events: [1],
            next: function (ce) {
				switch (state) {
				case 1:
					send('I\'m milking the cow ....');
					last = Date.now();
					state = 2;
					break;
				case 2:
					if (((Date.now() - last) < minutes(2))) {
						send('The cow kicked the bucket... try later');
					} else {
						send('I\'m skimming the milk... try later');
					}
					state = 4;
					window.setTimeout(function () { state = 3; }, getRandomArbitrary(minutes(6), minutes(8)));
					break;
				case 3:
					send('Have your raw milk');
					send(':' + ce.message_id + ' http://i.imgur.com/99jt9Xx.gif');
					window.setTimeout(function () { state = 1; }, getRandomArbitrary(minutes(6), minutes(8)));
					state = 4;
					break;
				default:
					// stay quiet
					break;
				}
            }
        };
    }

    /* offer cupcakes */
    function Cupcake() {
        var cmd = '!!cupcake', last, state = 1;
        return {
		    command: cmd,
			events: [1],
            next: function (ce) {
				switch (state) {
				case 1:
					send('One cupcake on it\'s way for @' + ce.user_name + ' ....');
					send(':' + ce.message_id + ' http://i.stack.imgur.com/87OMls.jpg', 25);
					last = Date.now();
					state = 2;
					break;
				case 2:
					if (((Date.now() - last) < minutes(10))) {
						send('Out of dough...');
					} else {
						send('Don\'t hammer me...');
					}
					state = 3;
					break;
				case 3:
					send('new cupcakes can be ordered in 6 to 8 minutes...', 5, 30);
					window.setTimeout(function () { state = 1; }, getRandomArbitrary(minutes(6), minutes(8)));
					state = 4;
					break;
				default:
					// stay quiet
					break;
				}
            }
        };
    }

    /* shutdown for Shadow Wizard */
    function Shutdown() {
        var going = false;
        return {
		    command: '!!SHU',
			events: [1],
            next: function (ce) {
                if (ce.user_name.toLowerCase().indexOf('shadow wizard') !== -1 &&
                        !going) {
                    send('No, @' + ce.user_name + ' that only works on NOVELL NETWARE');
                    going = true;
                    window.setTimeout(function () { going = false; }, minutes(1));
                }
            }
        };
    }

    function Silence() {
        return {
		    command : '!!silence',
		    events: [1],
            next: function () {
                silent = true;
            }
        };
    }

    function Wut() {
        var i = 0;
        return {
		    command : '!!wut',
			events: [1],
            next: function () {
				switch (i) {
				case 0:
					send('WUT?');
					i = i + 1;
					break;
				case 1:
					send('What are you talking about?');
					i = i + 1;
					break;
				case 2:
					send('Maybe lookup my instructions?');
					i = i + 1;
					break;
				default:
				    send('That is all gibberish to me...');
				    i = 0;
					break;
				}
            }
        };
    }

	function Status() {
	    var msg, statussilent = false;
		return {
			command : '!!status',
			events: [1],
			next: function () {
				var u, usr;
				if (!statussilent) {
				    msg = 'BOT running since: ' +  started.toString() + '\r\nusername (#msg)\r\n';
					for (u in seenUsers) {
					    if (seenUsers.hasOwnProperty(u)) {
							usr = seenUsers[u];
							if (usr.name && usr.cnt) {
								msg = msg + usr.name + ' (' +  usr.cnt + ')'  + '\r\n';
							}
						}
					}
					send(msg);
					window.setTimeout(function () { statussilent = false; }, minutes(60));
					statussilent = true;
				}
			}
		};
	}

	function Help() {
	    var msg = '', infosilent = false;
		return {
			command : '!!help',
			events: [1],
			next: function (e, a) {
				if (!infosilent) {
				    if (a !== undefined) {
						msg = a + '\r\n';
					}
					$(states).each(function () {
					    if (this.command) {
							msg = msg + this.command  + '\r\n';
						}
					});
					send(msg);
					window.setTimeout(function () { infosilent = false; }, minutes(60));
					infosilent = true;
				}
			}
		};
	}

    unk = new Wut();  // unknown handler

    /* register all statemachines */
    states.push(new TrainState());
    states.push(new StarResponse());
    states.push(new Coffee());
    states.push(new Cupcake());
	states.push(new Milk());
    states.push(new Shutdown());
    states.push(new Silence());
	states.push(new Status());
	states.push(new Help());
    states.push(unk);

    function handleEvent(ce) {
        var i, commandExecuted, length, state, cmdRegex = /^(!!\w+)($|\s(.*))/, cmd;
        commandExecuted = false;
		if (ce.user_id === thisuser) {
            commandExecuted = handleCommands(ce);
        }
		length = states.length;
		for (i = 0; i < length; i = i + 1) {
			state = states[i];
			cmd = cmdRegex.exec(ce.content);
			if ((state.events !== undefined && (state.events.indexOf(ce.event_type) > -1)) &&
					(state.command === undefined || (cmd !== null && cmd.length > 0 && cmd[1] === state.command))) {
				if (cmd !== null && cmd.length > 1) {
					state.next(ce, cmd[2]);
				} else {
					state.next(ce);
				}
				if (state.command !== undefined) {
					commandExecuted = true;
				}
			}
		}
		/* console.log('commandExecuted ' + commandExecuted.toString());
		console.log('event_type ' + ce.event_type.toString());
		console.log('ce.content.indexOf(\'!!\') ' + ce.content.indexOf('!!').toString()); */
		if (!commandExecuted
				&& ce.event_type === 1
				&& ce.content !== undefined) {
			if (ce.content.indexOf('!!') === 0) {
				unk.next();
			}
		}
    }

    function handleUser(user) {
		var fu = seenUsers[user.user_id];

		 // for throttling gather enough datapoints
		if (user.user_id === thisuser) {
			if (ownmsg.length > 100) {
				ownmsg.shift();
			}
			ownmsg.push(Date.now());
		}
		if (fu === undefined) {
			$.post('/user/info', {
				ids: [user.user_id],
				roomId:  room
			}).success(function (data) {
				if (data.users && data.users[0]) {
					console.log(data);
					seenUsers[user.user_id] = data.users[0];
					seenUsers[user.user_id].cnt = 0;
					if (data.users[0].is_owner === true || data.users[0].is_moderator) {
						roomOwners[user.user_id] = data.users[0];
					}
				}
			});
		} else {
			fu.cnt = fu.cnt + 1;
		}
	}

    function handleEvents(ce) {
        var i;
        for (i = 0; i < ce.length; i = i + 1) {
            handleEvent(ce[i]);
			handleUser(ce[i]);
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
                    {text: (txt.indexOf(':') !== 0 ? prep : '') + txt, fkey : fkey().fkey }).fail(
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

        // arr has event times in (milli)seconds, ts will be the current time
        // new items are push-ed so ther newest is at the end
        function isCurrentRateFine(seconds) {
            var limit = 0.0,
                a = seconds.length,
                b = 0,
                throttled = false,
                baseSecs = Date.now(),
                i;

            function rateLimit(x) {
                return Math.min((4.1484 * Math.log(x < 2 ? 2 : x) + 1.02242), 20);
            }

            for (i = seconds.length - 1; i > 0; i = i - 1) {
                limit = rateLimit(a - i);

                if (baseSecs - seconds[i] < limit && !throttled) {
                    throttled = true;
                    b = limit - (baseSecs - seconds[i]);
                    baseSecs = seconds[i];
                } else {
                    if (b - (baseSecs - seconds[i]) < 0) {
                        a = i;
                        throttled = false;
                        baseSecs = seconds[i];
                    }
                    if (baseSecs - seconds[i] > limit && !throttled) {
                        throttled = false;
                    }

                    if (baseSecs - seconds[i] > limit * 2) {
                        a = i;
                        throttled = false;
                        baseSecs = seconds[i];
                    }
                }
            }

            limit = rateLimit(a);

            return !(baseSecs - seconds[0] < limit);
        }

        // this sends out chatmessage while we are within the rate-limits
        window.setInterval(function () {
            var txt;
            if (isCurrentRateFine(ownmsg)) {
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
