var converter = new showdown.Converter();
const docStatus = $("#doc-status"),
  title_input = $("#title_input"),
  textarea = $("#comment"),
  output_area = $("#two"),
  past_blog = $(".past-blog"),
  new_modal = $("#new-modal"),
  add_new = $("#add-new");

let binder = {
  set: function (obj, prop, value) {
    console.log(value);
    if (prop == "current") {
      if (value) {
        docStatus
          .text("Saved")
          .toggleClass("badge-primary badge-warning", false)
          .toggleClass("badge-success", true);
      } else {
        docStatus
          .text("Changed")
          .toggleClass("badge-primary badge-success", false)
          .toggleClass("badge-warning", true);
      }

      // window.saved = value;
    }
    obj[prop] = value;
    return true;
  },
};

let saved = new Proxy({ current: true }, binder);

function wordCount(data) {
  return data
    .replace(/\W+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((item) => item).length;
}

textarea.on("input", function (event) {
  // console.log(event.shiftKey, event.ctrlKey, event.altKey, event.which);
  // console.log(event);
  // if (!event.ctrlKey || (event.shiftKey && event.which == 16) || event.altKey) {
  html = converter.makeHtml($(this).val());
  output_area.html(html);
  $("#word-count>span").html(wordCount($(this).val()));
  saved["current"] = false;
});

title_input.on("input", () => (saved["current"] = false));

//Save function
$(document).keydown(function (event) {
  // If Control or Command key is pressed and the S key is pressed
  // run save function. 83 is the key code for S.
  if (event.ctrlKey && (event.which == 83 || event.which == 115)) {
    // Save Function
    event.preventDefault();
    // console.log("save has been called");
    if (title_input.val().trim() !== "" || textarea.val().trim() !== "") {
      $.ajax({
        method: "POST",
        url: "/v1/api/scratch/blogs",
        data: JSON.stringify({
          content: textarea.val(),
          title: title_input.val(),
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
      saved["current"] = true;
      get_all_blogs();
    }
    return false;
  }
});

function get_all_blogs() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  navbar = $("#list-blogs-modal .modal-body ul");
  $.ajax({
    method: "GET",
    url: "/v1/api/scratch/blogs",
    success: (data) => {
      past_blog.remove();
      $(data).each(function (key, item) {
        // console.log(item);
        try {
          date = formatter.format(Date.parse(item.last_updated));
        } catch {
          console.log(item.last_updated);
          date = "";
        }
        navbar.append(
          '<li class="past-blog list-group-item-action list-group-item d-flex justify-content-between align-items-center" data-dismiss="modal" data-cid="' +
            item.cid +
            '">' +
            "<p>" +
            item.title +
            '</p><p><small class="text-muted time">' +
            date +
            "</small></p></li>"
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
  textarea.val("");
  title_input.val("");
  output_area.html("");
  saved["current"] = true;
  $("#word-count>span").html(wordCount($(this).val()));
}

add_new.click(function () {
  if (!saved["current"]) {
    new_modal.modal({ show: true });
  } else {
    clear();
  }
});

$("#new-modal button").click(function () {
  if ("accept" in $(event.target).data()) {
    clear();
  }
  new_modal.modal({ show: false });
});

$("#delete").click(() => {
  if (
    window.cid ||
    title_input.val().trim() !== "" ||
    textarea.val().trim() !== ""
  ) {
    $("#delete-modal").modal({ show: true });
  }
});

$("#delete-modal button").click(function (event) {
  if ("accept" in $(event.target).data()) {
    console.log("accept");
    $.ajax({
      method: "DELETE",
      url: "/v1/api/scratch/blogs/" + window.cid,
      success: (data) => {
        console.log(data);
        clear();
        get_all_blogs();
      },
    });
  } else {
    console.log("dismiss");
  }
});

// get a existing blog
$(document).on("click", ".past-blog", function (event) {
  // console.log(event.target);
  $.ajax({
    method: "GET",
    url: "/v1/api/scratch/blogs/" + $(event.target).data().cid,
    success: (data) => {
      // console.log(data);
      textarea.val(data.content).trigger("input");
      title_input.val(data.title);
      window.cid = data.cid;
      saved["current"] = true;
    },
  });
});
