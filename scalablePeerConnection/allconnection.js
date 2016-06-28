var PeerConnection = require('./peerconnection.js');
var Indicator = require('./indicator.js');

function AllConnection(){
	var host;
	var parent;
	var local;
	var stream;
	var socket;
	var configuration;
	var localVideo;
	var sourceBuffer;
	this.connection = {};
	this.indicator = new Indicator();
	this.ms = new MediaSource();
	
	setInterval(function(){
		console.log("set current time");
		self.localVideo.currentTime = 10000;
	}, 10000);
}

//initialise the setup of AllConnection
AllConnection.prototype.init = function(user, socket, config){
	var self = this;
	this.local = user;
	this.socket = socket;
	this.configuration = config;
	this.localVideo = document.getElementById("localVideo");
	this.localVideo.src = window.URL.createObjectURL(this.ms);
	this.localVideo.autoplay = true;
	this.ms.addEventListener('sourceopen', function(){
		// this.readyState === 'open'. Add source buffer that expects webm chunks.
		self.sourceBuffer = self.ms.addSourceBuffer('video/webm; codecs="vorbis,vp8"');
		self.sourceBuffer.mode = "sequence";
		console.log(self.sourceBuffer);
	});
}

//initialise the setup of own camera
AllConnection.prototype.initCamera = function(){
	var self = this;

	if (self.indicator.hasUserMedia()) {
		navigator.getUserMedia({ video: true, audio: true }, function(stream){
			self.stream = stream;
			//self.startRecording(stream);
			self.localVideo.src = window.URL.createObjectURL(stream);
		}, function (error) {
			console.log(error);
		});
	} else {
		alert("Sorry, your browser does not support WebRTC.");
	}
}

//initialise a connection with peers
AllConnection.prototype.initConnection = function(peer){	
	var self = this;
	self.localVideo = document.getElementById("localVideo");
	self.localVideo.autoplay = true;
	self.connection[peer] = new PeerConnection(self.local, peer, self.socket, self.configuration, self.sourceBuffer);
	self.connection[peer].startConnection(function(){
		self.connection[peer].openDataChannel(function(){
			self.connection[peer].hostSetupPeerConnection(peer, self.stream, function(){
				self.connection[peer].makeOffer( function(offer){
					self.socket.emit("SDPOffer", {
						type: "SDPOffer",
						local: self.local,
						remote: peer,
						offer: offer
					});
				});
			});
		});
	});
}

//when receive an spd offer
AllConnection.prototype.onOffer = function(sdpOffer, cb){
	var self = this;
	self.localVideo = document.getElementById("localVideo");
	self.localVideo.autoplay = true;
	peer = sdpOffer.remote;
	self.connection[peer] = new PeerConnection(self.local, peer, self.socket, self.configuration, self.sourceBuffer);
	self.connection[peer].startConnection(function(){
		self.connection[peer].openDataChannel(function(){
			self.connection[peer].visitorSetupPeerConnection(peer, /*function(stream){
				self.stream = stream;
				cb();
			}, */function(){
				self.connection[sdpOffer.remote].receiveOffer(sdpOffer.offer, function(sdpAnswer){
					self.socket.emit("SDPAnswer", {
						type: "SDPAnswer",
						local: self.local,
						remote: sdpOffer.remote,
						answer: sdpAnswer
					});
				});
			});
		});
	});
}

//when receive an spd answer
AllConnection.prototype.onAnswer = function(sdpAnswer, cb){
	this.connection[sdpAnswer.remote].receiveAnswer(sdpAnswer.answer);
}

//when receive an ice candidate
AllConnection.prototype.onCandidate = function(iceCandidate){
	this.connection[iceCandidate.remote].addCandidate(iceCandidate);
}

AllConnection.prototype.deleteConnection = function(peer){
	self.connection[peer] = null;
}

//set the ICE server 
AllConnection.prototype.setIceServer = function(iceServers){
	this.iceServers = iceServers;
}

AllConnection.prototype.setLocalStream = function(streamStatus){
	this.stream = this.connection[streamStatus.host].stream;
	this.startRecording(this.stream);
}

module.exports = AllConnection;