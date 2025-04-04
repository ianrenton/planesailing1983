const SERVER_URL = "https://planesailing.ianrenton.com/api/";

// Set up Cesium
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2ZWVjNWJhYS1hNjUyLTRkYWEtODE5MC1hMWFkYWQ0NzBhYTEiLCJpZCI6NjkxMDEsImlhdCI6MTYzMzE2MTI2OX0._M65C5gcKo2ou4xpXbbcS6JC6hobPcPQ7Cos4VOxdEE';
const viewer = new Cesium.Viewer('map', {
  baseLayerPicker : false,
  timeline: false,
  animation: false
});

// Hide the skybox and atmosphere
viewer.scene.skyBox.destroy();
viewer.scene.skyBox = undefined;
viewer.scene.sun.destroy();
viewer.scene.sun = undefined;
viewer.scene.backgroundColor = Cesium.Color.BLACK;
viewer.scene.skyAtmosphere.show = false;
viewer.scene.fog.enabled = false;
viewer.scene.globe.showGroundAtmosphere = false;

// Set up layers
viewer.scene.globe.imageryLayers.removeAll();
viewer.scene.globe.baseColor = Cesium.Color.BLACK;
var tonerLayer = viewer.scene.globe.imageryLayers.addImageryProvider(
    new Cesium.OpenStreetMapImageryProvider({
        url : 'https://tiles.stadiamaps.com/tiles/stamen_toner_background/',
        credit : '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/about" target="_blank">OpenStreetMap</a> contributors'
    })
);
tonerLayer.alpha = 0.2;

// Set up green filter post-processing
var stages = viewer.scene.postProcessStages;
stages.add(new Cesium.PostProcessStage({
    fragmentShader : "uniform sampler2D colorTexture;\n\
\n\
varying vec2 v_textureCoordinates;\n\
\n\
void main(void)\n\
{\n\
    vec3 rgb = texture2D(colorTexture, v_textureCoordinates).rgb;\n\
    vec3 green = vec3(0.0, 1.0, 0.0);\n\
    gl_FragColor = vec4(rgb * green, 1.0);\n\
}\n\
"
}));

// Set initial view
viewer.camera.setView({
  destination : Cesium.Cartesian3.fromDegrees(-1.8, 50.7, 100000),
});

// Data storage
var tracks = new Map(); // id -> Track object
var markers = new Map(); // id -> Marker
var clockOffset = 0;

// Fetch data
async function fetchData() {
  $.ajax({
    url: SERVER_URL + "update",
    dataType: 'json',
    timeout: 10000,
    success: async function(result) {
      handleData(result);
    }
  });
}

fetchData();
setInterval(fetchData, 10000);
setInterval(updateMap, 1000);

async function handleData(result) {
  clockOffset = moment().diff(moment(result.time).utc(), 'seconds');
  tracks.clear();
  tracks = objectToMap(result.tracks);
}

async function updateMap() {
  markers.forEach(function(m) {
    viewer.entities.remove(m);
  });
  markers.clear();

  tracks.forEach(function(t) {
    var pos = getPosition(t);
    var image = "square";
    if (t["tracktype"] == "SHIP") {
      image = "arrowdown";
    } else if (t["tracktype"] == "AIRCRAFT") {
      image = "arrowup";
    }
    if (pos != null) {
      var m = viewer.entities.add({
        position : Cesium.Cartesian3.fromDegrees(getPosition(t)[1], getPosition(t)[0]),
        billboard : {
          image : 'images/' + image + '.png',
          width : 16,
          height : 16
        },
        label : {
          text : t["name"],
          font : '14pt VT323',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth : 4,
          verticalOrigin : Cesium.VerticalOrigin.CENTER,
          horizontalOrigin : Cesium.HorizontalOrigin.LEFT,
          pixelOffset : new Cesium.Cartesian2(16, 0)
        }
      });
      markers.set(t["id"], m); 
    }
  });
}

// Utility function to get local PC time with data time offset applied.
function getTimeInServerRefFrame() {
  return moment().subtract(clockOffset, "seconds");
}

// Utility to convert an object created by JSON.parse() into a proper JS map.
function objectToMap(o) {
  let m = new Map();
  for(let k of Object.keys(o)) {
    m.set(k, o[k]); 
  }
  return m;
}

// Get the dead reckoned position of a track based on its last position
// update plus course and speed at that time.
function getPosition(t) {
  if (t["lat"] != null && t["postime"] != null && t["course"] != null && t["speed"] != null && t["speed"] > 1.0) {
    // Can dead reckon
    var timePassedSec = getTimeInServerRefFrame().diff(t["postime"]) / 1000.0;
    var speedMps = t["speed"] * 0.514444;
    return dest(t["lat"], t["lon"], t["course"], timePassedSec * speedMps);
    return [newPos.lat, newPos.lng];
  } else if (t["lat"] != null) {
    return [t["lat"], t["lon"]];
  } else {
    return null;
  }
}

// Haversine destination from start bearing & distance
function dest(lat, lon, course, distance) {
    var startLatitudeRadians = lat * Math.PI / 180;
    var startLongitudeRadians = lon * Math.PI / 180;
    var courseRadians = course * Math.PI / 180;
    var distMovedRadians = distance / 6371000.0;
        
    var cosphi1 = Math.cos(startLatitudeRadians);
    var sinphi1 = Math.sin(startLatitudeRadians);
    var cosAz = Math.cos(courseRadians);
    var sinAz = Math.sin(courseRadians);
    var sinc = Math.sin(distMovedRadians);
    var cosc = Math.cos(distMovedRadians);
        
    var endLatitudeRadians = Math.asin(sinphi1 * cosc + cosphi1 * sinc * cosAz);
    var endLongitudeRadians = Math.atan2(sinc * sinAz, cosphi1 * cosc - sinphi1 * sinc * cosAz) + startLongitudeRadians;
        
    var endLatitudeDegrees = endLatitudeRadians * 180 / Math.PI;
    var endLongitudeDegrees = endLongitudeRadians * 180 / Math.PI;
        
    return [endLatitudeDegrees, endLongitudeDegrees];
};
