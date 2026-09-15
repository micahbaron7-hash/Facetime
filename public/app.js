const socket = io();

let localStream;
let room;
const peers = {};

const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    },
    {
      urls: "stun:stun1.l.google.com:19302"
    }
  ]
};

async function joinRoom() {

  room = document
    .getElementById("roomInput")
    .value
    .trim()
    .toUpperCase();

  if (!room) {
    document.getElementById("error").textContent =
      "Enter a room code.";
    return;
  }

  try {

    localStream =
      await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

    addVideo(
      "local",
      localStream,
      "You"
    );

    socket.emit("join-room", room);

    document.getElementById("joinScreen")
      .classList.add("hidden");

    document.getElementById("callScreen")
      .classList.remove("hidden");

    document.getElementById("roomDisplay")
      .textContent = room;

    history.pushState(
      {},
      "",
      "?room=" + encodeURIComponent(room)
    );

  } catch (error) {

    document.getElementById("error").textContent =
      "Please allow your camera and microphone.";
  }
}


socket.on("room-users", async users => {

  for (const userId of users) {

    if (userId === socket.id) continue;

    await createPeer(userId, true);
  }
});


socket.on("user-joined", async userId => {

  await createPeer(userId, false);
});


socket.on("signal", async ({ from, data }) => {

  let peer = peers[from];

  if (!peer) {
    peer = await createPeer(from, false);
  }

  if (data.offer) {

    await peer.setRemoteDescription(
      new RTCSessionDescription(data.offer)
    );

    const answer =
      await peer.createAnswer();

    await peer.setLocalDescription(answer);

    socket.emit("signal", {
      to: from,
      data: {
        answer: peer.localDescription
      }
    });
  }

  if (data.answer) {

    await peer.setRemoteDescription(
      new RTCSessionDescription(data.answer)
    );
  }

  if (data.candidate) {

    try {
      await peer.addIceCandidate(
        new RTCIceCandidate(data.candidate)
      );
    } catch {}
  }
});


socket.on("user-left", userId => {

  if (peers[userId]) {
    peers[userId].close();
    delete peers[userId];
  }

  const element =
    document.getElementById("video-" + userId);

  if (element) {
    element.remove();
  }
});


async function createPeer(userId, initiator) {

  if (peers[userId]) {
    return peers[userId];
  }

  const peer =
    new RTCPeerConnection(configuration);

  peers[userId] = peer;

  localStream
    .getTracks()
    .forEach(track => {
      peer.addTrack(track, localStream);
    });

  peer.onicecandidate = event => {

    if (event.candidate) {

      socket.emit("signal", {
        to: userId,
        data: {
          candidate: event.candidate
        }
      });

    }
  };

  peer.ontrack = event => {

    addVideo(
      userId,
      event.streams[0],
      "Guest"
    );

  };

  if (initiator) {

    const offer =
      await peer.createOffer();

    await peer.setLocalDescription(offer);

    socket.emit("signal", {
      to: userId,
      data: {
        offer: peer.localDescription
      }
    });
  }

  return peer;
}


function addVideo(id, stream, name) {

  let box =
    document.getElementById("video-" + id);

  if (!box) {

    box = document.createElement("div");

    box.className = "videoBox";
    box.id = "video-" + id;

    box.innerHTML = `
      <video autoplay playsinline></video>
      <div class="name">${name}</div>
    `;

    document
      .getElementById("videos")
      .appendChild(box);
  }

  const video =
    box.querySelector("video");

  video.srcObject = stream;
}


function toggleMic() {

  const track =
    localStream.getAudioTracks()[0];

  track.enabled = !track.enabled;

  document.getElementById("micButton")
    .textContent =
    track.enabled
      ? "🎙️ Mute"
      : "🔇 Unmute";
}


function toggleCamera() {

  const track =
    localStream.getVideoTracks()[0];

  track.enabled = !track.enabled;

  document.getElementById("cameraButton")
    .textContent =
    track.enabled
      ? "📷 Camera Off"
      : "📷 Camera On";
}


function newRoom() {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 6; i++) {

    code +=
      chars[Math.floor(
        Math.random() * chars.length
      )];

  }

  document.getElementById("roomInput")
    .value = code;

  joinRoom();
}


async function copyLink() {

  const link =
    window.location.origin +
    "/?room=" +
    encodeURIComponent(room);

  try {

    await navigator.clipboard.writeText(link);

    alert("Invite link copied!");

  } catch {

    prompt(
      "Copy this link:",
      link
    );

  }
}


function leaveCall() {

  Object.values(peers)
    .forEach(peer => peer.close());

  if (localStream) {

    localStream
      .getTracks()
      .forEach(track => track.stop());
  }

  window.location.href = "/";
}


// Automatically fill a room if someone opens an invite link.

const params =
  new URLSearchParams(window.location.search);

const savedRoom =
  params.get("room");

if (savedRoom) {

  document.getElementById("roomInput")
    .value =
    savedRoom.toUpperCase();
}
