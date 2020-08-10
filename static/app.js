var converter = new showdown.Converter();

$("textarea").on("change keyup paste", function () {
  html = converter.makeHtml($(this).val());
  $("#two").html(html);
});

$("#fas-minimized").click(() => {
  $(".navbar-minimized").hide();
  $(".navbar-custom").show();
});

$("#fas-maximized").click(() => {
  $(".navbar-minimized").show();
  $(".navbar-custom").hide();
});

$(document).on("keydown", function (event) {
  $(".navbar-minimized").show();
  $(".navbar-custom").hide();
});

$(document).keydown(function (event) {
  // If Control or Command key is pressed and the S key is pressed
  // run save function. 83 is the key code for S.
  if (
    (event.ctrlKey || event.metaKey) &&
    (event.which == 83 || event.which == 115)
  ) {
    // Save Function
    event.preventDefault();
    // console.log("save has been called");
    $.ajax({
      method: "POST",
      url: "/v1/api/scratch/blog",
      data: JSON.stringify({
        content: $("#comment").val(),
        title: $("#title_input").val(),
        uid: 'uid' in window ? window.uid : null,
        cid: 'cid' in window ? window.cid : null
      }),
      contentType: "application/json",
      success: (data) => {
        window.cid = data.cid;
        window.last_updated = data.last_updated;
      },
      error : (data) => {
        alert(data.responseJSON.message);
      },
      dataType: "json",
    });
    return false;
  }
});

function signOut() {
  var auth2 = gapi.auth2.getAuthInstance();
  auth2.signOut().then(function () {
    console.log("User signed out.");
  });
  delete window.uid;
  delete window.cid;
  $('#signOutButton').hide();
  $('.avatar img').remove();
}

function onSignIn(googleUser) {
  // Useful data for your client-side scripts:
  var profile = googleUser.getBasicProfile();
  console.log("ID: " + profile.getId()); // Don't send this directly to your server!
  window.uid = profile.getId();
  console.log("Full Name: " + profile.getName());
  console.log("Given Name: " + profile.getGivenName());
  console.log("Family Name: " + profile.getFamilyName());
  console.log("Image URL: " + profile.getImageUrl());
  console.log("Email: " + profile.getEmail());
  img = new Image();
  img.src = profile.getImageUrl();
  $('.avatar').append(img);
  // The ID token you need to pass to your backend:
  var id_token = googleUser.getAuthResponse().id_token;
  console.log("ID Token: " + id_token);

  $.ajax({
    method: "POST",
    url: "/tokensignin",
    data: JSON.stringify({
      idtoken: id_token
    }),
    contentType: "application/json",
    success: (data) => {
      console.log("Signed in as: " + data);
    },
    dataType: "json",
  });

  $('#signOutButton').show();
}

function isUserSignedIn() {
    gapi.load('auth2', function() {
        var isSignedIn = auth2.isSignedIn.get();
        console.log('is signed in? ', isSignedIn)
    })
  }