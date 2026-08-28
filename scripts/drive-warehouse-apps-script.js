const FOLDER_ID = "1Sk2TqgpF6NxoNYdUKO4h8t84UA7KxChN";
const TOKEN = "cCpNneNyv0_MTyPjAZMkJ3g69t0DfDE-GP84y26YGhU";
// Capture display/original binaries use travelos__moments__photos__{momentId}__* names.
// LockService is for op=index / op=item merge-on-write only. Binary POSTs stay parallel.

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function tokenOk_(e) {
  var token = (e && e.parameter && e.parameter.token) || "";
  if (!token && e && e.postData && e.postData.contents) {
    try {
      token = JSON.parse(e.postData.contents).token || "";
    } catch (err) {}
  }
  return token === TOKEN;
}

function folder_() {
  return DriveApp.getFolderById(FOLDER_ID);
}

function listFiles_() {
  var folder = folder_();
  var files = folder.getFiles();
  var listed = [];
  while (files.hasNext()) {
    var file = files.next();
    listed.push({
      id: file.getId(),
      mimeType: file.getMimeType(),
      name: file.getName(),
    });
  }
  return listed;
}

function readIndexObject_() {
  var files = folder_().getFilesByName("moments.json");
  if (!files.hasNext()) {
    return { jobs: [], moments: [], schemaVersion: 2, updatedAt: new Date().toISOString() };
  }
  try {
    return JSON.parse(files.next().getBlob().getDataAsString());
  } catch (err) {
    return { jobs: [], moments: [], schemaVersion: 2, updatedAt: new Date().toISOString() };
  }
}

function photoKey_(photo) {
  return (photo && (photo.storageKey || photo.id || photo.originalFilename)) || "";
}

function mergePhotos_(left, right) {
  var byKey = {};
  var order = [];
  function absorb(photo) {
    if (!photo) {
      return;
    }
    var key = photoKey_(photo);
    if (!key) {
      order.push(photo);
      return;
    }
    var current = byKey[key];
    if (!current) {
      byKey[key] = photo;
      order.push(photo);
      return;
    }
    var merged = {};
    var names = Object.keys(current).concat(Object.keys(photo));
    for (var i = 0; i < names.length; i++) {
      merged[names[i]] = photo[names[i]] != null && photo[names[i]] !== "" ? photo[names[i]] : current[names[i]];
    }
    merged.originalStorageKey = photo.originalStorageKey || current.originalStorageKey;
    byKey[key] = merged;
    var idx = order.indexOf(current);
    if (idx >= 0) {
      order[idx] = merged;
    }
  }
  (left || []).forEach(absorb);
  (right || []).forEach(absorb);
  return order;
}

function mergeMoment_(base, extra) {
  var merged = {};
  var names = Object.keys(base || {}).concat(Object.keys(extra || {}));
  for (var i = 0; i < names.length; i++) {
    merged[names[i]] = extra[names[i]] != null ? extra[names[i]] : base[names[i]];
  }
  merged.id = extra.id || base.id;
  merged.photos = mergePhotos_(base.photos, extra.photos);
  merged.originalAudioUrl =
    extra.originalAudioUrl != null ? extra.originalAudioUrl : base.originalAudioUrl;
  return merged;
}

function mergeMomentLists_(left, right) {
  var byId = {};
  var order = [];
  function absorb(moment) {
    if (!moment || !moment.id) {
      return;
    }
    var current = byId[moment.id];
    if (!current) {
      byId[moment.id] = moment;
      order.push(moment.id);
      return;
    }
    byId[moment.id] = mergeMoment_(current, moment);
  }
  (left || []).forEach(absorb);
  (right || []).forEach(absorb);
  return order.map(function (id) {
    return byId[id];
  });
}

function upsertNamed_(name, contents, mimeType) {
  var folder = folder_();
  var existing = folder.getFilesByName(name);
  var blob = Utilities.newBlob(contents, mimeType, name);
  var kept = null;
  while (existing.hasNext()) {
    var file = existing.next();
    if (!kept) {
      kept = file;
    } else {
      file.setTrashed(true);
    }
  }
  if (kept) {
    kept.setTrashed(true);
  }
  folder.createFile(blob);
}

function withLock_(work) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return work();
  } finally {
    lock.releaseLock();
  }
}

function writeIndex_(body) {
  var incoming = JSON.parse(body.text || "{}");
  var existing = readIndexObject_();
  var merged = {
    jobs: incoming.jobs || existing.jobs || [],
    moments: mergeMomentLists_(existing.moments, incoming.moments),
    schemaVersion: incoming.schemaVersion || existing.schemaVersion || 2,
    updatedAt: new Date().toISOString(),
  };
  upsertNamed_("moments.json", JSON.stringify(merged, null, 2), "application/json");
  return json_({ ok: true, name: "moments.json" });
}

function writeItem_(body) {
  var name = String(body.name || "item.json");
  var incomingItem = JSON.parse(body.text || "{}");
  var existingItem = {};
  var itemFiles = folder_().getFilesByName(name);
  if (itemFiles.hasNext()) {
    try {
      existingItem = JSON.parse(itemFiles.next().getBlob().getDataAsString());
    } catch (err) {
      existingItem = {};
    }
  }
  var existingMoment = existingItem.moment || existingItem;
  var incomingMoment = incomingItem.moment || incomingItem;
  var mergedMoment = mergeMoment_(existingMoment, incomingMoment);
  var record = { moment: mergedMoment, updatedAt: new Date().toISOString() };
  upsertNamed_(name, JSON.stringify(record, null, 2), "application/json");
  return json_({ ok: true, name: name });
}

function createBinaryFile_(body) {
  var filename = String(body.name || "file-" + Date.now());
  var mime = String(body.mimeType || "application/octet-stream");
  var bytes = Utilities.base64Decode(body.base64);
  var file = folder_().createFile(Utilities.newBlob(bytes, mime, filename));
  return json_({ id: file.getId(), name: file.getName() });
}

function doGet(e) {
  if (!tokenOk_(e)) {
    return json_({ error: "unauthorized" });
  }
  var op = (e.parameter && e.parameter.op) || "";
  if (op === "index") {
    return json_(readIndexObject_());
  }
  if (op === "list") {
    return json_({ files: listFiles_() });
  }
  var id = e.parameter && e.parameter.id;
  if (!id) {
    return json_({ error: "missing id" });
  }
  var file = DriveApp.getFileById(id);
  var blob = file.getBlob();
  return json_({
    id: id,
    name: file.getName(),
    mimeType: blob.getContentType(),
    base64: Utilities.base64Encode(blob.getBytes()),
  });
}

function doPost(e) {
  if (!tokenOk_(e)) {
    return json_({ error: "unauthorized" });
  }
  var body = JSON.parse(e.postData.contents);
  if (body.op === "list") {
    return json_({ files: listFiles_() });
  }
  // moments.json / item JSON merge-on-write needs the script lock.
  // Photo/binary createFile POSTs (no op, or a base64 body) must stay unlocked
  // so Capture can dump 40 files in parallel without waitLock(30000) throws.
  if (body.op === "index") {
    return withLock_(function () {
      return writeIndex_(body);
    });
  }
  if (body.op === "item") {
    return withLock_(function () {
      return writeItem_(body);
    });
  }
  return createBinaryFile_(body);
}
