
function DataChannel(p2pConnection, socket, peer, sourceBuffer){
	var self = this;
	var dataChannel;
	this.p2pConnection = p2pConnection;
	this.socket = socket;
	this.peer = peer;
	this.sourceBuffer = sourceBuffer;
	this.chunkUpdating = false;
	this.chunks = [];
	this.videoData = [];
	this.chunkSize = 10000;
}

DataChannel.prototype.open = function(){
	var self = this;
	// could change to other 
	setInterval(function(){			
		console.log("here");
		if (self.chunks.length > 0 && !self.sourceBuffer.updating){
			console.log(self.sourceBuffer);
			var data = self.chunks.shift();
			self.sourceBuffer.appendBuffer(data);
		}}, 10);

	var dataChannelOptions = {
			ordered: true,
			reliable: true,
			negotiated: true,
			id: "myChannel"
	};

	this.dataChannel = this.p2pConnection.createDataChannel("label", dataChannelOptions);

	MessageEnum = {
			OFFER: "offer",
			ANSWER: "answer",
			TIMESTAMP: "timeStamp",
			TIMESTAMPRESPONSE: "timeStampResponse"
	}

	self.dataChannel.onerror = function (error) {
		console.log("Data Channel Error:", error);
	};

	self.dataChannel.onmessage = function (msg) {
		if (msg.data instanceof ArrayBuffer){
			self.onStream(msg.data);
		}

		else if (isJson(msg.data)){
			message = JSON.parse(msg.data);

			switch(message.type){

			case MessageEnum.TIMESTAMP:
				console.log("received time stamp");
				self.onTimeStamp(message);
				break;

			case MessageEnum.TIMESTAMPRESPONSE:
				self.onTimeStampResponse(message);
				break;
			}
		} else {
			message = msg.data + "<br />"
			document.getElementById("info").innerHTML += message;
		}
	};

	self.dataChannel.onopen = function () {
		console.log("dataChannel opened");
		self.dataChannel.send("connected.");
		self.socket.emit("dataChannelStatus", {
			type: "dataChannelStatus",
			status: "success"
		});
	};

	self.dataChannel.onclose = function () {
		console.log("The Data Channel is Closed");
	};
}

DataChannel.prototype.send = function(message){
	this.dataChannel.send(message);
}

DataChannel.prototype.addVideo = function(stream) {
	// Add stream
	this.startRecording(stream);
	//this.p2pConnection.addStream(stream);
}


DataChannel.prototype.onStream = function(streamBuffer) {
	this.chunks.push(streamBuffer);	
}

//receive an spd answer
DataChannel.prototype.onAnswer = function(sdpAnswer){
	sdpAnswer = new RTCSessionDescription(sdpAnswer);
	this.p2pConnection.setRemoteDescription(sdpAnswer,function(){}, function(){});
	console.log(this.p2pConnection.localDescription);
	console.log(this.p2pConnection.remoteDescription);
}

DataChannel.prototype.onTimeStamp = function(timeStamp){
	var respondTime = Date.now();
	var timeStampResponse = {
			type: "timeStampResponse",
			sendTime: timeStamp.sendTime,
			respondTime: respondTime
	}
	timeStampResponse = JSON.stringify(timeStampResponse);
	this.dataChannel.send(timeStampResponse);
}

DataChannel.prototype.onTimeStampResponse = function(timeStampResponse){
	var self = this;
	receiveTime = Date.now();
	console.log("sendTime is " + message.sendTime);
	console.log("respondTime is " + message.respondTime);
	console.log("receiveTime is " + receiveTime);

	this.socket.emit("timeStamp", {
		type: "timeStamp",
		peer: self.peer,
		sendTime: message.sendTime,
		respondTime: message.respondTime,
		receiveTime: receiveTime
	});
}

function isJson(str) {
	try {
		JSON.parse(str);
	} catch (e) {
		return false;
	}
	return true;
}

module.exports = DataChannel;