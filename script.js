{
    computed: {
        eventTitle() {
            return this.plan.event.title;
        },
        //Get a list of note categories
        noteCategories() {
            var categories = {};
            for (var i = 0; i < this.plan.schedules.length; i++) {
                if (this.plan.schedules[i].notes) {
                    for (var cat in this.plan.schedules[i].notes) {
                        categories[cat] = {};
                    }
                }
            }

            //Convert the keys into an array
            var ret = [];
            for (var key in categories) {
                ret.push(key);
            }
            return ret;
        },
        //Get the time remaining for the current item in MM:SS
        itemTimeRemaining() {
            return this.formatSeconds(Math.floor(this.itemTimeRemainingSec / 1000));
        },
        //Convert the start date to the time in ms to be converted back
        startDate() {
            return Date.parse(this.plan.startDate);
        },
        isLoggedIn() {
            return this.$fluro.app.user;
        },
        userId() {
            if (!this.isLoggedIn) {
                return this.randomUserId;
            }
            if (!this.$fluro.app.user) {
                return this.randomUserId;
            }
            return this.$fluro.app.user._id;
        },
        userName() {
            if (!this.$fluro.app.user) {
                return "Unknown";
            }

            return this.$fluro.app.user.title || this.$fluro.app.user.name || this.$fluro.app.user.firstName || "Unknown";
        },
        //Does the user have control over the plan
        hasControl() {
            return this.userInControl === undefined || this.userInControl == this.userId;
        },
        //Grab our plan id from the event
        planId() {
            if (this.data.plan) {
                console.log("We have a defined plan");
                return this.data.plan._id;
            } else if (this.$fluro.app.page.params.id) {
                console.log("We have a plan id passed as a slug");
                return this.$fluro.app.page.params.id;
            }
            return undefined;
        },
        criteria() {
            var temp = {
                allDefinitions: true,
                filter: {
                    operator: 'and',
                    filters: [{
                            key: 'startDate',
                            comparator: 'datenotbefore',
                            computedValue: "t"
                        },
                        {
                            key: 'plans',
                            comparator: 'notempty'
                        }
                    ]
                },
                sort: {
                    key: 'startDate', //The field to sort on
                    type: 'date', //How to sort
                    direction: 'asc', //Descending or Ascending
                },
            };

            //If we have a filter set in the config add it
            if (this.data.filter && this.data.filter.filters.length > 0) {
                temp.filter = this.data.filter;
                temp.filter.filters.push({
                    key: 'startDate',
                    comparator: 'datenotbefore',
                    computedValue: "t"
                });
                temp.filter.filters.push({
                    key: 'plans',
                    comparator: 'notempty'
                });
            }

            return temp;
        },
        //Login form
        fields() {

            var self = this;
            var array = [];

            //Add a username field
            addField('username', {
                title: 'Email Address',
                type: 'string',
                minimum: 1,
                maximum: 1,
            })

            addField('password', {
                title: 'Password',
                type: 'string',
                directive: 'password',
                minimum: 1,
                maximum: 1,
            })

            ////////////////////////////

            function addField(key, details) {
                if (!details.key) {
                    details.key = key;
                }

                array.push(details);
            }

            ////////////////////////////

            //Return our array
            return array;
        },
        //Get the current item
        current() {
            if (!this.currentItem) {
                return undefined;
            }
            return this.plan.schedules[this.currentItem];
        },
        //Get the next item
        next() {
            if (!this.currentItem) {
                return undefined;
            }

            //Try to find the next item
            for (var i = this.currentItem + 1; i < this.plan.schedules.length - 1; i++) {
                if (this.plan.schedules[i].type != "breaker" && this.plan.schedules[i].type != "start") {
                    return this.plan.schedules[i];
                }
            }

            return this.plan.schedules[this.currentItem];
        }
    },
    data() {
        var application = this.data ? this.data.application : null;
        return {
            loading: true,
            loginPrompt: false,
            listType: "event",
            listFields: ["title", "startDate", "firstLine", "plans"],
            plan: undefined,
            debug: true,
            pollInterval: undefined,
            timerInterval: undefined,
            itemTimeRemainingSec: 0,
            currentTime: Date.now(),
            collapsePlan: true,
            hidePreviousItems: true,
            updaterDelay: undefined,
            showMobileControlMenu: false,
            showHeadcount: false,
            headcount: 50,
            pollTimeout: 5000,
            showMessage: false,
            messageContent: {
                icon: "",
                title: "",
                description: "",
                type: ""
            },

            currentItem: undefined,
            userInControl: undefined,
            nameInControl: undefined,
            itemStartedAt: undefined,
            planStartedAt: undefined,

            socketChannel: null,
            session: null,
            credentials: {
                username: '', // 'test@test.com',
                password: '', // 'password',
            }
        }
    },
    watch: {
        '$fluro.app.user': 'checkLogin',
        'data.application': 'setApplicationID',

    },
    mounted() {
        this.getPlan().then((result) => {
            this.socketSubscribe();
        }).catch((error) => {});
        this.randomUserId = (Math.random() + 1).toString(36).substring(7);
    },
    created() {
        this.setApplicationID();
        this.checkLogin();
    },
    methods: {
        socketSubscribe() {
            var hid = this.$fluro ? (this.$fluro.app.user ? this.$fluro.app.user._hid : undefined) : undefined;
            if (hid && this.$socket && this.plan && this.plan._id) {
                console.log("Subscribing to socket");
                this.socketChannel = this.$socket.channel(hid, this.plan._id);
                this.socketChannel.on("content.edit", this.socketEvent);
                this.pollTimeout = 30000;
                this.pollInterval = setInterval(this.poll, this.pollTimeout); //Incase the socket goes sad
            } else {
                //We cannot connect to the socket so we will use polling
                console.log("Cannot use socket, failover to polling");
                this.pollTimeout = 5000;
                this.pollInterval = setInterval(this.poll, this.pollTimeout);
            }
        },
        socketEvent(message) {
            console.log("Got socket event");
            this.poll();
        },

        //Get the time remaining for the current item in miliseconds
        calcTimeRemaining() {
            this.currentTime = Date.now();
            if (this.itemStartedAt && this.plan && this.plan.schedules[this.currentItem]) {

                this.itemTimeRemainingSec = (this.plan.schedules[this.currentItem].duration * 1000) - (Date.now() - this.itemStartedAt);

            } else {
                this.itemTimeRemainingSec = 0;
            }
        },
        message(type, message, title, icon) {
            var self = this;
            var titleSet = "";
            var iconSet = "";
            switch (type) {
                case "error": {
                    titleSet = "Something happened";
                    iconSet = "times";
                    break
                }
                case "warning": {
                    titleSet = "Warning";
                    iconSet = "exclamation";
                    break
                }
                case "info": {
                    titleSet = "Information";
                    iconSet = "info";
                    break
                }
                case "success": {
                    titleSet = "Success!";
                    iconSet = "check";
                    break
                }
            }

            if (title) {
                titleSet = title;
            }
            if (icon) {
                iconSet = icon;
            }

            this.messageContent.type = type;
            this.messageContent.icon = iconSet;
            this.messageContent.title = titleSet;
            this.messageContent.description = message;
            this.showMessage = true;

            setTimeout(function() {
                self.showMessage = false;
            }, 3000);
        },
        done(ret, index = 0, array = []) {
            if (index >= array.length - 1) {
                this.loading = false;
            }
            return ret;
        },
        //Get the current item and time offsets
        poll() {
            console.log("POLL");
            if (!this.planId) {
                return;
            }
            this.$fluro.api.get("/content/plan/" + this.planId, {
                    cache: false,
                    params: {
                        select: "data"
                    }
                })
                .then(result => {
                    this.readData(result.data.data);
                }).catch(error => {
                    console.log("ERROR: Failed to get poll information from Fluro");
                    console.log(error);
                });
        },
        //Update the plan with the current item if in control
        update(takeControl = false, force = false) {
            var self = this;

            if (takeControl == true) {
                this.userInControl = this.userId;
                this.nameInControl = this.userName;
            } else if (!force && !this.hasControl) {
                return;
            }

            clearTimeout(this.updaterDelay);
            clearInterval(this.pollInterval);
            var resetPollInterval = () => {
                self.pollInterval = setInterval(self.poll, self.pollTimeout);
            }

            this.updaterDelay = setTimeout(function() {
                console.log("Update the plan on Fluro!");
                // self.ignoreIncoming = true;

                // this.userInControl = this.userId;
                self.$fluro.api.put("/content/plan/" + self.planId, {
                        "data": self.generateData()
                    })
                    .then(result => {
                        console.log("Done!");
                        resetPollInterval();
                        self.message("success", "", "Plan Updated");
                    }).catch(error => {
                        console.log("ERROR: Failed to update the information to Fluro");
                        console.log(error);
                        resetPollInterval();
                        self.message("error", "Something happened while updating the plan. Try reloading the page?", "Couldn't update the plan");
                    });
            }, 1000);
        },
        //Force control of the plan
        takeControl() {
            this.update(true);
        },
        //Release control of the plan
        releaseControl() {
            this.userInControl = "";
            this.nameInControl = "No one";
            this.update(false, true);
        },
        //Switch to the next item
        nextItem() {
            if (!this.hasControl) {
                this.message("warning", "You don't have control of the plan", "Couldn't do that!");
                return;
            }

            if (this.currentItem === undefined || (this.currentItem >= this.plan.schedules.length - 1)) {
                this.currentItem = 0;
            } else {
                this.currentItem++;
            }

            //If the item is a break skip to the next item
            var type = this.plan.schedules[this.currentItem].type;
            if (type == "breaker" || type == "start") {
                this.nextItem();
            }

            //If the event has not started this will be our start
            if (!this.planStartedAt) {
                this.planStartedAt = Date.now();
            }

            this.itemStartedAt = Date.now();
            this.update();
        },
        //Switch to the previous item
        previousItem() {
            if (!this.hasControl) {
                this.message("warning", "You don't have control of the plan", "Couldn't do that!");
                return;
            }

            if (this.currentItem === undefined || (this.currentItem <= 0)) {
                this.currentItem = this.plan.schedules.length - 1;
            } else {
                this.currentItem--;
            }

            //If the item is a break skip to the next item
            var type = this.plan.schedules[this.currentItem].type;
            if (type == "breaker" || type == "start") {
                this.previousItem();
            }

            this.itemStartedAt = Date.now();
            this.update();
        },
        //Restart the plan from now
        restartPlan() {
            if (!this.hasControl) {
                this.message("warning", "You don't have control of the plan", "Couldn't do that!");
                return;
            }

            this.currentItem = undefined;
            this.itemStartedAt = undefined;
            this.planStartedAt = undefined;
            this.nextItem();
        },
        //Start the plan
        startPlan() {
            this.userInControl = this.userId;
            this.nameInControl = this.userName;
            this.restartPlan();
        },
        showCollapsePlan() {
            this.collapsePlan = !this.collapsePlan;
        },
        showPreviousItems() {
            this.hidePreviousItems = !this.hidePreviousItems;
        },
        //Read the data from Fluro
        readData(data) {
            if (data) {
                this.currentItem = data.currentItem;
                this.userInControl = data.userInControl;
                this.itemStartedAt = data.itemStartedAt;
                this.planStartedAt = data.planStartedAt;
                this.nameInControl = data.nameInControl;

            } else {
                this.currentItem = undefined;
                this.userInControl = undefined
                this.itemStartedAt = undefined;
                this.planStartedAt = undefined;
                this.nameInControl = undefined;
            }
        },
        //Generate our data to send to Fluro
        generateData() {
            return {
                "currentItem": this.currentItem,
                "userInControl": this.userInControl,
                "itemStartedAt": this.itemStartedAt,
                "planStartedAt": this.planStartedAt,
                "nameInControl": this.nameInControl
            }
        },
        //Get the plan from Fluro and subscribe for further updates
        getPlan() {
            return new Promise((resolve, reject) => {
                var self = this;
                clearInterval(self.pollInterval);
                clearInterval(self.timerInterval);

                if (!this.planId) {
                    console.log("Failed to get plan information because there is no plan id");
                    self.plan = false;
                    reject();
                    return;
                }

                this.$fluro.api.get("/content/plan/" + this.planId, {
                        cache: false,
                        select: ["data", "schedules", "event"]
                    })
                    .then(result => {
                        self.readData(result.data.data);
                        self.plan = result.data;
                        self.timerInterval = setInterval(self.calcTimeRemaining, 500);
                        // self.pollInterval = setInterval(self.poll, 5000);

                        //Get further information about our items
                        var waitingFor = [];
                        var currentDuration = 0;
                        for (var i = 0; i < self.plan.schedules.length; i++) {
                            var curr = self.plan.schedules[i];

                            //Set the offset for this item in the plan
                            curr.timeOffset = currentDuration;
                            currentDuration += curr.duration;

                            //If the item is a specific type add more information about it
                            if (curr.type == "song") {
                                waitingFor.push(this.$fluro.api.get("/content/song/" + curr.links[0], {}));
                            } else {
                                waitingFor.push({});
                            }
                        }

                        //When we have everything extra add it
                        Promise.all(waitingFor).then((results) => {
                            for (var i = 0; i < results.length; i++) {
                                self.plan.schedules[i].extra = results[i].data;
                            }
                            resolve(this.plan);
                            self.loading = false;
                        }).catch(errors => {
                            console.log("ERROR: Failed to get song information");
                            console.log(errors);
                            this.message("warning", "Failed to get some song information");
                            resolve(this.plan);
                            self.loading = false;
                        });
                    }).catch(error => {
                        console.log("ERROR: Failed to get plan information from Fluro");
                        console.log(error);
                        this.message("error", "Failed to get the plan from Fluro");
                        reject();
                        self.plan = false;
                    });
            });
        },
        //Returns a HTML formated string with the format MM:SS with a colour
        formatSeconds(seconds) {
            var colorClass = seconds < 10 ? "timeRed" : seconds < 60 ? "timeYellow" : "timeRegular";
            return `<div class='${colorClass}'>${this.secondsToMinSec(seconds)}</div>`;
        },
        //Get the current time formatted as HH:MM:SS
        timeFormatted(currentDate, hour24 = false, hourHas0 = true, showHourIf0 = true) {
            var date = new Date(currentDate);
            if (hour24) {
                return (showHourIf0 ? (hourHas0 ? ("0" + date.getHours()).slice(-2) : date.getHours()) + ":" : "") + ("0" + date.getMinutes()).slice(-2) + ":" + ("0" + date.getSeconds()).slice(-2);
            } else {
                //Format to AM PM

                var amPM = "AM";
                var hour = date.getHours();
                if (hour > 12) {
                    amPM = "PM";
                    hour -= 12;
                }
                if (hour == 0) {
                    hour = 12;
                }
                return hour + ":" + ("0" + date.getMinutes()).slice(-2) + ":" + ("0" + date.getSeconds()).slice(-2) + " " + amPM;
            }

        },
        //Convert seconds to MM:SS
        secondsToMinSec(sec) {
            var secAbs = Math.abs(sec);
            var neg = sec < 0;
            var mins = Math.floor(secAbs / 60);
            return (neg ? "-" : "") + mins + ":" + ("0" + (secAbs - (mins * 60))).slice(-2);
        },
        //Handle a click on an item from the plan
        handleItemClick(index, type) {
            var item = this.plan.schedules[index];
            if (item.type == "song") {
                //Open the song in Fluro

                //If the requested click is a youtube click
                if (type == "youtube") {
                    window.open(item.extra.data.videos[0].external.youtube, '_blank').focus();
                } else {
                    window.open("http://app.fluro.io/list/article/song/" + item.extra._id + "/view", '_blank').focus();
                }
            }
        },
        //Page to redirect to when a plan is selected
        redirectPlan(id) {
            if (this.data.page) {
                return `./${this.data.page}/${id}`;
            }
            return "./" + id;
        },
        //Save the current headcount value to Fluro
        saveHeadcount() {
            if (!this.$fluro.app.user) {
                console.log("ERROR: No user");
                this.message("error", "You need to be logged in to set a headcount", "Please login");
                return;
            }

            console.log(`Save headcount of ${this.headcount} to event ${this.eventTitle}`);
            this.loading = true;

            var count = this.headcount || 0;
            var areas = [];

            this.$fluro.content.retrieve({
                _type: "attendance",
                event: this.plan.event._id
            }).then((result) => {
                if (result.length > 0) {
                    //We have an existing headcount, just update it.
                    console.log("-- Updating the headcount");
                    this.$fluro.api.put("/content/attendance/" + result[0]._id, {
                        "count": count,
                        "areas": areas
                    }).then((result) => {
                        console.log("Done!");
                        this.showHeadcount = false;
                        this.loading = false;
                        this.message("success", "The headcount was updated", "Headcount added");
                    }).catch((error) => {
                        console.log("ERROR: Failed to update the information to Fluro");
                        console.log(error);
                        this.showHeadcount = false;
                        this.loading = false;
                        this.message("error", "There was a problem trying to update the headcount", "Couldn't add the headcount");
                    });
                } else {
                    //Create a new headcount
                    console.log("-- Creating the headcount");
                    this.$fluro.api.post("/content/_import", {
                            "_type": "attendance",
                            "title": `${this.eventTitle} attendance report`,
                            "event": this.plan.event._id,
                            "count": count,
                            "data": {},
                            "managedOwners": [{
                                "_id": this.$fluro.app.user.persona
                            }],
                            "managedAuthor": {
                                "_id": this.$fluro.app.user.persona
                            },
                            "areas": areas,
                            "realms": this.plan.event.realms
                        })
                        .then(result => {
                            console.log("Done!");
                            this.showHeadcount = false;
                            this.loading = false;
                            this.message("success", "The headcount was created", "Headcount added");
                        }).catch(error => {
                            console.log("ERROR: Failed to update the information to Fluro");
                            console.log(error);
                            this.showHeadcount = false;
                            this.loading = false;
                            this.message("error", "There was a problem trying to create the headcount", "Couldn't add the headcount");
                        });
                }
            });
        },

        /**
         * Login specifics
         **/

        //Open prompt to login to Fluro
        logout() {
            this.$fluro.app.user = null;
            location.reload();
        },
        login() {
            this.loginPrompt = true;
        },
        loginSuccess(session) {
            this.$fluro.app.user = session;
            this.loginPrompt = false;
            this.message("success", "Reloading the page", "Login successful!");
            window.location.reload();
        },
        loginError() {
            this.$fluro.app.user = null;
            this.message("error", "That login didn't work, please try again", "Login failed");
        },
        checkLogin() {
            var self = this;
            var user = self.$fluro.app.user;

            if (!user) {
                self.session = false;
                return;
            }

            // console.log('Request the session from the server')
            self.$fluro.api.get('/session', {
                    cache: false,
                })
                .then(function(res) {
                    // console.log('Got a response!', res);
                    self.session = res.data;
                })
        },
        setApplicationID() {

            if (this.data) {
                this.credentials.application = this.$fluro.utils.getStringID(this.data.application);
            } else {
                this.credentials.application = null;
            }
        },
    },
}