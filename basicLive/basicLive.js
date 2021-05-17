// create Agora client
var client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
var localTracks = {
  videoTrack: null,
  audioTrack: null
};
var remoteUsers = {};
// Agora client options
var options = { 
  appid: null,
  channel: null,
  uid: null,
  token: null,
  role: "audience" // host or audience
};

var imagesLoaded = 0;
var imgTitle = loadImage("./title.png", imageLoadCompleted);
var context = mycanvas.getContext("2d");
var video = document.getElementById("my-demo");

function loadImage(src, onload) {
  var img = new Image();
  img.onload = function() {
      onload();
  };
  img.src = src;
  return img;
}

function imageLoadCompleted() {
  imagesLoaded += 1;
  // 这里只有一张图需要加载，因此已加载图片数量大于等于1即可
  if(imagesLoaded>=1) {
    if (navigator.mediaDevices === undefined) {
      navigator.mediaDevices = {};
    }
    var constraints = { audio: true, video: { width: 1280, height: 720 } };

    navigator.mediaDevices.getUserMedia(constraints)
    .then(function(mediaStream) {
      var video = document.querySelector('video');
      video.srcObject = mediaStream;
      video.onloadedmetadata = function(e) {
        video.addEventListener('loadeddata', function() {
          updateVideoToCanvas();
        });
        video.play();
      };
    })
    .catch(function(err) { console.log(err.name + ": " + err.message); });
    }
}
            
function updateVideoToCanvas() {
  context.clearRect(0, 0, mycanvas.width, mycanvas.height);
  context.drawImage(video, 0, 0, 800, 600);
  context.globalAlpha = 1;
  context.drawImage(imgTitle, 0, 0);
  requestAnimationFrame(updateVideoToCanvas);
}





// the demo can auto join channel with params in url
$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.token = urlParams.get("token");
  if (options.appid && options.channel) {
    $("#appid").val(options.appid);
    $("#token").val(options.token);
    $("#channel").val(options.channel);
    $("#join-form").submit();
  }
})

$("#host-join").click(function (e) {
  options.role = "host"
})

$("#audience-join").click(function (e) {
  options.role = "audience"
})

$("#join-form").submit(async function (e) {
  e.preventDefault();
  $("#host-join").attr("disabled", true);
  $("#audience-join").attr("disabled", true);
  try {
    options.appid = $("#appid").val();
    options.token = $("#token").val();
    options.channel = $("#channel").val();
    await join();
    if (options.role === "host") {
      $("#success-alert a").attr("href", `index.html?appid=${options.appid}&channel=${options.channel}&token=${options.token}`);
      if(options.token) {
        $("#success-alert-with-token").css("display", "block");
      } else {
        $("#success-alert a").attr("href", `index.html?appid=${options.appid}&channel=${options.channel}&token=${options.token}`);
        $("#success-alert").css("display", "block");
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    $("#leave").attr("disabled", false);
  }
})

$("#leave").click(function (e) {
  leave();
})

async function join() {
  // create Agora client
  client.setClientRole(options.role);

  if (options.role === "audience") {
    // add event listener to play remote tracks when remote user publishs.
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);
  }

  // join the channel
  options.uid = await client.join(options.appid, options.channel, options.token || null);

  if (options.role === "host") {
    canvasStream = mycanvas.captureStream(25);
    const [videoTrack] = canvasStream.getVideoTracks();
    let localVideoTrack = AgoraRTC.createCustomVideoTrack({
      mediaStreamTrack: videoTrack,
    });
    localTracks.videoTrack = localVideoTrack;
    // create local audio and video tracks
    localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    //localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack();
    //localTracks.videoTrack = videoTrack
    // play local video track
    localTracks.videoTrack.play("local-player");
    $("#local-player-name").text(`localTrack(${options.uid})`);
    // publish local tracks to channel
    await client.publish(Object.values(localTracks));
    console.log("publish success");
  }
}

async function leave() {
  for (trackName in localTracks) {
    var track = localTracks[trackName];
    if(track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
  }

  // remove remote users and player views
  remoteUsers = {};
  $("#remote-playerlist").html("");

  // leave the channel
  await client.leave();

  $("#local-player-name").text("");
  $("#host-join").attr("disabled", false);
  $("#audience-join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  console.log("client leaves channel success");
}

async function subscribe(user, mediaType) {
  const uid = user.uid;
  // subscribe to a remote user
  await client.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === 'video') {
    const player = $(`
      <div id="player-wrapper-${uid}">
        <p class="player-name">remoteUser(${uid})</p>
        <div id="player-${uid}" class="player"></div>
      </div>
    `);
    $("#remote-playerlist").append(player);
    user.videoTrack.play(`player-${uid}`);
  }
  if (mediaType === 'audio') {
    user.audioTrack.play();
  }
}

function handleUserPublished(user, mediaType) {
  const id = user.uid;
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}

function handleUserUnpublished(user) {
  const id = user.uid;
  delete remoteUsers[id];
  $(`#player-wrapper-${id}`).remove();
}
