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
      url: "/v1/api/scratch/blogs",
      data: JSON.stringify({
        content: $("#comment").val(),
        title: $("#title_input").val(),
        cid: "cid" in window ? window.cid : null,
      }),
      contentType: "application/json",
      success: (data) => {
        window.cid = data.cid;
        window.last_updated = data.last_updated;
      },
      error: (data) => {
        alert(data.responseJSON.message);
      },
      dataType: "json",
    });
    return false;
  }
});

function get_all_blogs() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  navbar = $(".navbar-custom");
  $.ajax({
    method: "GET",
    url: "/v1/api/scratch/blogs",
    success: (data) => {
      $(".past-blog").remove();
      $(data).each(function (key, item) {
        // console.log(item);
        try {
          date = formatter.format(Date.parse(item.last_updated));
        } catch {
          console.log(item.last_updated);
          date = "";
        }
        navbar.append(
          '<div class="past-blog">' +
            '<h5 data-cid="' +
            item.cid +
            '">' +
            item.title +
            '</h5><p><span class="time">' +
            date +
            "</span></p></div>"
        );
      });
    },
  });
}

$(document).ready(function () {
  get_all_blogs();
});

function clear() {
  delete window.cid;
  // console.log("add new was called");
  $("#comment").val("");
  $("#title_input").val("");
  $("#two").html("");
}

$("#add-new").click(clear);

$("#delete-modal button").click(function (event) {
  if ("accept" in $(event.target).data()) {
    console.log("accept");
    $.ajax({
      method: "DELETE",
      url: "/v1/api/scratch/blogs/" + window.cid,
      success: (data) => {
        console.log(data);
        $(".navbar-minimized").show();
        $(".navbar-custom").hide();
        clear();
        get_all_blogs();
      },
    });
  } else {
    console.log("dismiss");
  }
});

// $(".past-blog h5").click(function () {
//   console.log("wah");
// });

$(document).on("click", ".past-blog h5", function (event) {
  $.ajax({
    method: "GET",
    url: "/v1/api/scratch/blogs/" + $(event.target).data().cid,
    success: (data) => {
      $("#comment").val(data.content);
      $("#title_input").val(data.title);
      window.cid = data.cid;
      $(".navbar-minimized").show();
      $(".navbar-custom").hide();
    },
  });
});
