
function PeerConnection(local, peer, socket, localVideo, config, sourceBuffer){
	var p2pConnection;
	var indicator;
	var dataChannel;
	var stream;
	this.index = 0;
	this.chunkUpdating = false;
	this.chunks = [];
	this.videoData = [];
	this.sourceBuffer = sourceBuffer;
	this.user = local;
	this.remote = peer;
	this.socket = socket;
	this.localVideo = localVideo;
	this.configuration = config;
	this.chunkSize = 10000;
}

//Visitor setup the p2p connection with a peer
PeerConnection.prototype.visitorSetupPeerConnection = function(peer,/* streamCallback,*/ cb) {
	var self = this;
	// Setup stream listening
	/*	this.p2pConnection.onaddstream = function (e) {
		self.localVideo.src = window.URL.createObjectURL(e.stream);
		streamCallback(e.stream);
		console.log("received a stream");
		console.log(e.stream);
	};*/



//	Setup ice handling
	this.p2pConnection.onicecandidate = function (event) {
		if (event.candidate) {
			self.socket.emit("candidate", {
				type: "candidate",
				local: self.user,
				remote: peer,
				candidate: event.candidate
			});
		}
	};
	cb();
}

//Host setup the p2p connection with a peer
PeerConnection.prototype.hostSetupPeerConnection = function(peer, stream, cb) {
	var self = this;
	// Add stream
	//this.p2pConnection.addStream(stream);

	// Setup ice handling
	this.p2pConnection.onicecandidate = function (event) {
		if (event.candidate) {
			self.socket.emit("candidate", {
				type: "candidate",
				local: self.user,
				remote: peer,
				candidate: event.candidate
			});
		}
	};
	cb();
}

PeerConnection.prototype.addVideo = function(stream) {
	// Add stream
	var self = this;
	self.startRecording(stream);
	//this.p2pConnection.addStream(stream);
	this.makeOffer( function(sdpOffer){
		sdpOffer.sdp = sdpOffer.sdp.replace(/a=sendrecv/g,"a=sendonly");
		sdpOffer = JSON.stringify(sdpOffer);
		self.dataChannel.send(sdpOffer);
	});
}

PeerConnection.prototype.onAddVideo = function(sdpOffer) {
	// Add stream
	var self = this;
	this.p2pConnection.onaddstream = function (e) {
		self.setLocalStream(e.stream);
	};
	this.receiveOffer(sdpOffer, function(sdpAnswer){
		sdpAnswer = JSON.stringify(sdpAnswer);
		sdpOffer.sdp = sdpOffer.sdp.replace(/a=sendrecv/g,"a=recvonly");
		self.dataChannel.send(sdpAnswer);
	});
}

//initialise p2pconnection at the start of a peer connection 
PeerConnection.prototype.startConnection = function(cb){
	this.p2pConnection = new RTCPeerConnection(this.configuration);
	cb();
}

PeerConnection.prototype.openDataChannel = function(cb){
	var self = this;
	var dataChannelOptions = {
			ordered: true,
			reliable: true,
			negotiated: true,
			id: "myChannel"
	};

	self.dataChannel = this.p2pConnection.createDataChannel("label", dataChannelOptions);

	self.dataChannel.onerror = function (error) {
		console.log("Data Channel Error:", error);
	};

	self.dataChannel.onmessage = function (msg) {
		if (msg.data instanceof ArrayBuffer){
			console.log("received arraybuffer");
			self.chunks.push(msg.data);
			console.log(self.chunks.length);
			if (!self.sourceBuffer.updating){
				var data = self.chunks.shift();
				self.startReceiving(data);
			}	
		}

		else if (isJson(msg.data)){
			message = JSON.parse(msg.data);

			if (message.type === "offer"){
				self.onAddVideo(message);

			}else if (message.type === "answer"){
				self.receiveAnswer(message);

			}else if (message.type === "timeStamp"){
				var respondTime = Date.now();
				var timeStampResponse = {
						type: "timeStampResponse",
						sendTime: message.sendTime,
						respondTime: respondTime
				}
				timeStampResponse = JSON.stringify(timeStampResponse);
				self.dataChannel.send(timeStampResponse);

			}else if (message.type === "timeStampResponse"){
				receiveTime = Date.now();
				console.log("sendTime is " + message.sendTime);
				console.log("respondTime is " + message.respondTime);
				console.log("receiveTime is " + receiveTime);

				self.socket.emit("timeStamp", {
					type: "timeStamp",
					user: self.user,
					peer: self.remote,
					sendTime: message.sendTime,
					respondTime: message.respondTime,
					receiveTime: receiveTime
				});
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
	cb();
}


//make an sdp offer
PeerConnection.prototype.makeOffer = function(cb)	{
	var self = this;
	this.p2pConnection.createOffer(function (sdpOffer) {
		//sdpOffer.sdp = sdpOffer.sdp.replace(/a=sendrecv/g,"a=sendonly");
		self.p2pConnection.setLocalDescription(sdpOffer);
		cb(sdpOffer);
	}, function(error){
		console.log(error);
	});
}

//receive an sdp offer and create an sdp answer
PeerConnection.prototype.receiveOffer = function(sdpOffer, cb){
	var self = this;
	sdpOffer = new RTCSessionDescription(sdpOffer);
	this.p2pConnection.setRemoteDescription(sdpOffer, function(){
		self.p2pConnection.createAnswer(function (answer) {
			//answer.sdp = answer.sdp.replace(/a=sendrecv/g,"a=recvonly");
			self.p2pConnection.setLocalDescription(answer);
			console.log(self.p2pConnection.localDescription);
			console.log(self.p2pConnection.remoteDescription);
			cb(answer);
		},function(error){
			console.log(error);
		});
	}, function(){});
}

//receive an spd answer
PeerConnection.prototype.receiveAnswer = function(sdpAnswer){
	sdpAnswer = new RTCSessionDescription(sdpAnswer);
	this.p2pConnection.setRemoteDescription(sdpAnswer,function(){}, function(){});
	console.log(this.p2pConnection.localDescription);
	console.log(this.p2pConnection.remoteDescription);
}

//add ice candidate when receive one
PeerConnection.prototype.addCandidate = function(iceCandidate) {
	this.p2pConnection.addIceCandidate(new RTCIceCandidate(iceCandidate.candidate), function(){}, function(){
		console.log("fail");
	});
}

PeerConnection.prototype.setLocalStream = function(stream){
	var self = this;
	this.stream = stream;
	this.socket.emit("streamStatus", {
		type: "streamStatus",
		host: self.remote,
		status: "success"
	});
}

PeerConnection.prototype.startRecording = function(stream) {
	var self = this;
	var mediaRecorder = new MediaRecorder(stream);
//	will freeze if lose socket	
	mediaRecorder.start(30);

	mediaRecorder.ondataavailable = function (e) {
		var reader = new FileReader();
		reader.addEventListener("loadend", function () {

			var arr = new Uint8Array(reader.result);
			self.videoData.push(arr);

			if (!self.chunkUpdating){
				self.chunkUpdating = true;
				var data = self.videoData.shift();
				console.log(data.byteLength);
				var chunkLength = data.byteLength/self.chunkSize ; 

				for (var i = 0; i<= chunkLength ; i++){
					if (data.byteLength < self.chunkSize*(i + 1)){
						var endByte = data.byteLength;
					} else{
						var endByte = self.chunkSize*(i + 1);
					}
					self.chunks.push(data.slice(self.chunkSize* i, endByte));
					if (endByte = data.byteLength){
						self.chunkUpdating = false;
					}
				}

				if(!self.sourceBuffer.updating){
					console.log("startSending");
					var chunk = self.chunks.shift();
					self.dataChannel.send(chunk);
					self.sourceBuffer.appendBuffer(chunk);
				}
			}
		});
		console.log(e.data);
		reader.readAsArrayBuffer(e.data);
	};

	mediaRecorder.onstart = function(){
		console.log('Started, state = ' + mediaRecorder.state);
	};
}

PeerConnection.prototype.startReceiving = function(data) {
	var self = this;
	console.log("startReceiving");
	self.sourceBuffer.appendBuffer(data);
}


function isJson(str) {
	try {
		JSON.parse(str);
	} catch (e) {
		return false;
	}
	return true;
}

module.exports = PeerConnection;