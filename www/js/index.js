var app = {
    device: null,
    deviceName: "SousVide",
    serviceUUID: "1812",
    readLoopInterval: null,
    settingSetpoint: null,
    settingTimer: null,
    characteristics: [
        {
            "sensor": "temp",
            "id": "2A6E"
        },
        {
            "sensor": "setpoint",
            "id": "0004"
        },
        {
            "sensor": "timer",
            "id": "2703"
        }
    ],

    // Application Constructor
    initialize: function () {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },

    // deviceready Event Handler
    //
    // Bind any cordova events here. Common events are:
    // 'pause', 'resume', etc.
    onDeviceReady: function () {
        this.receivedEvent('deviceready');
        console.log("OnDecieReady Ran");
        bluetoothle.initialize(app.bleSuccessCallback, app.bleErrorCallback, {
            "request": true,
            "statusReceiver": false,
            "restoreKey": "bluetoothleplugin"
        });

        // Set listeners
        var inputs = $("#inputs input");
        var title = $("#inputs h3");
        $("#controls-setpoint").click(function() {
            inputs.removeClass("active");

            $("#setting-setpoint").addClass("active");
            title.html("Update Setpoint");
        });

        $("#controls-timer").click(function() {
            inputs.removeClass("active");

            $("#setting-timer").addClass("active");
            title.html("Update Timer");
        });

        $("#setting-setpoint").change(function() {
            app.updateSetpoint($(this).val());
            console.log("Setpoint updated: " + app.settingSetpoint);
        });

        $("#setting-timer").change(function() {
            app.updateTimer($(this).val());
            console.log("Timer updated: " + app.settingTimer);
        });
    },

    updateSetpoint: function(newSetpoint) {
        app.settingSetpoint = newSetpoint;
        $("#setting-setpoint").val(app.settingSetpoint);
        $("#setpoint").find(".value span").html(app.settingSetpoint);
    },

    updateTimer: function(newTimer) {
        app.settingTimer = newTimer;
        $("#setting-timer").val(app.settingTimer);
        $("#timer").find(".value span").html(app.settingTimer.toHHMMSS());
    },

    // Update DOM on a Received Event
    receivedEvent: function (id) {
        console.log('Received Event: ' + id);
    },

    bleSuccessCallback: function (result) {
        console.log("bleSuccessCallback");

        if (result.status === "disabled") {
            alert("Please fix the following error: " + result.message);
        }
        else {
            bluetoothle.hasPermission(app.bleHasPermissionSuccess);
        }
    },

    bleHasPermissionSuccess: function (result) {
        console.log("bleHasPermissionSuccess");
        console.log(result);

        if (!result.hasPermission) {
            bluetoothle.requestPermission(app.bleStartScan, app.bleErrorCallback);
        }
        else {
            app.bleStartScan();
        }
    },

    bleStartScan: function () {
        console.log("bleStartScan");

        bluetoothle.startScan(app.bleScanSuccess, app.bleErrorCallback, { "services": [app.serviceUUID] });
    },

    bleScanSuccess: function (result) {
        console.log("bleScanSuccess");
        console.log(result);

        if (result.hasOwnProperty("name") && result.name === app.deviceName) {
            app.device = result;
            bluetoothle.stopScan(app.bleDeviceFound, app.bleErrorCallback);
        }
    },

    bleDeviceFound: function () {
        console.log("bleDeviceFound");

        bluetoothle.retrieveConnected(app.bleRetrieveConnectedSuccess, app.bleErrorCallback, { "services": [app.serviceUUID] });
    },

    bleRetrieveConnectedSuccess: function(result) {
        console.log("bleRetrieveConnectedSuccess");
        console.log(result);

        var deviceConnected = false;

        // Check if device is already connected
        for (var i = 0; i < result.length; i++)
        {
            if (result[i].address === app.device.address)
            {
                deviceConnected = true;
            }
        }

        if (!deviceConnected) {
            bluetoothle.connect(app.bleConnectSuccess, app.bleErrorCallback, { "address" : app.device.address });
        } else {
            app.bleConnectSuccess({ status: "connected" });
        }
    },

    bleConnectSuccess: function(result) {
        console.log("bleConnectSuccess");
        console.log(result);

        if (result.status === "connected") {
            //app.bleReadLoopStart();
            // No need to discover as we already know the characteristics
            bluetoothle.discover(app.bleDiscoverSuccess, app.bleErrorCallback, {
                "address" : app.device.address,
                "clearCache" : true
            });
        } else if (result.status === "disconnected") {
            bluetoothle.reconnect(app.bleConnectSuccess, app.bleErrorCallback, { "address" : app.device.address });
        }
    },

    bleDiscoverSuccess: function(result) {
        console.log("bleDiscoverSuccess");
        console.log(result);
        // Service ID 0x1812

        var hidServiceFound = false;
        for (var i = 0; i < result.services.length; i++)
        {
            if (result.services[i].uuid === app.serviceUUID) {
                hidServiceFound = true;
                //app.service = result.services[i];
            }
        }
        console.log(app.characteristics);
        if (hidServiceFound) {
            app.bleReadLoopStart();
        }
        else
        {
            alert("HID service not found!");
        }
    },

    bleReadLoopStart: function () {
        app.bleReadLoop();
        app.readLoopInterval = setInterval(function() {app.bleReadLoop();}, 5000);
    },

    bleReadLoop: function () {
        for (var i = 0; i < app.characteristics.length; i++)
        {
            bluetoothle.read(
                app.bleReadSuccess,
                app.bleErrorCallback,
                {
                    address: app.device.address,
                    service: app.serviceUUID,
                    characteristic: app.characteristics[i].id
                }
            );
        }
    },

    bleReadSuccess: function (result) {
        console.log("Read Success: ");
        console.log(result);

        for (var i = 0; i < app.characteristics.length; i++)
        {
            if (app.characteristics[i].id === result.characteristic)
            {
                if (app.characteristics[i].sensor === "temp") {
                    // Reverse byte array to switch to little-endian
                    var byteArray = bluetoothle.encodedStringToBytes(result.value).reverse();

                    // Convert now to a byte string
                    var hexString = Array
                        .from (new Uint8Array (byteArray))
                        .map (b => b.toString (16).padStart (2, "0"))
                        .join ("");

                    var rawValue = parseInt('0x' + hexString);
                    var decimalValue = rawValue / 100;
                    var degreesF = (decimalValue * 9 / 5 + 32).toFixed(2);

                    $("#" + app.characteristics[i].sensor).find(".value span").html(degreesF);

                    $(".status").hide();
                    $(".status.safe").show();
                    $(".status.dabger").show();
                } else if (app.characteristics[i].sensor === "setpoint") {
                    console.log("Reading [" + result.characteristic + "]: " + result.value);
                    app.updateSetpoint(bluetoothle.encodedStringToBytes(result.value).toString());
                } else if (app.characteristics[i].sensor === "timer") {
                    console.log("Reading [" + result.characteristic + "]: " + result.value);
                    app.updateTimer(bluetoothle.encodedStringToBytes(result.value).toString());
                }
            }
        }
    },

    bleErrorCallback: function (result) {
        console.log(result);

        if (result.error === "connect")
        {
            bluetoothle.reconnect(app.bleConnectSuccess, app.bleErrorCallback, { "address" : app.device.address });
        }
    },

    bleUpdateSetpoint: function (newSetpoint) {
        var encoded = ble.bytesToEncodedString(int16ToReverseEndianByteArray(newSetpoint));
        debugger;

        bluetoothle.write(writeSuccess, writeError, {
            address: app.device.address,
            service: app.serviceUUID,
            characteristic: app.getCharacteristic("setpoint"),
            value: encoded
        });
    },
    bleUpdatePumpRunning: function(newPumpRunning) {
        var encoded = ble.bytesToEncodedString(int16ToReverseEndianByteArray(newPumpRunning));

        bluetoothle.write(app.bleWriteSuccess, app.bleErrorCallback, {
            address: app.device.address,
            service: app.serviceUUID,
            characteristic: app.getCharacteristic("pumpRunning"),
            value: encoded
        });
    },
    bleWriteSuccess: function(result) {
        console.log("Write Success");
        console.log(result);
    },

    getCharacteristic: function(sensor) {
        for (var i = 0; i < app.characteristics.length; i++) {
            if (app.characteristics[i].sensor === sensor) {
                return app.characteristics[i].id;
            }
        }

        return null;
    }
};

function int16ToReverseEndianByteArray(int) {
    // we want to represent the input as a 8-bytes array
    var byteArray = [0, 0];

    for ( var index = 0; index < byteArray.length; index ++ ) {
        var byte = int & 0xff;
        byteArray [ index ] = byte;
        int = (int - byte) / 256 ;
    }

    return byteArray;
}

String.prototype.toHHMMSS = function () {
    var sec_num = parseInt(this, 10); // don't forget the second param
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return hours+':'+minutes+':'+seconds;
}

app.initialize();