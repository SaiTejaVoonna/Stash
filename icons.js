// Stash icons: one place that turns an icon name into a Material Symbols
// (outlined) icon. window.CPIcon
//
// html(name, extraClass) gives a string, el(name, extraClass) gives an element.
// The icon name sits in a data attribute, not in the text, so screen readers,
// search and copy never see it as a word. A name with no match keeps the
// older drawn icon, so nothing ever shows up blank.
(function () {
  "use strict";

  const MAP = {
    "archive": "archive",
    "arrow-down": "arrow_downward",
    "arrow-up": "arrow_upward",
    "baby": "child_care",
    "bell": "notifications",
    "bike": "two_wheeler",
    "book": "menu_book",
    "bookmark": "bookmark",
    "briefcase": "work",
    "calendar": "calendar_today",
    "camera": "photo_camera",
    "car": "directions_car",
    "cart": "shopping_cart",
    "chat": "chat_bubble",
    "check": "check",
    "check-all": "done_all",
    "check-box": "check_box",
    "checklist": "checklist",
    "chevron-down": "expand_more",
    "chevron-left": "chevron_left",
    "chevron-right": "chevron_right",
    "clip": "attach_file",
    "clipboard": "assignment",
    "clock": "schedule",
    "close": "close",
    "cloud": "cloud",
    "cog": "settings",
    "command": "terminal",
    "command-key": "keyboard_command_key",
    "copy": "content_copy",
    "cross": "medical_services",
    "cup": "local_cafe",
    "database": "database",
    "dice": "casino",
    "download": "download",
    "dumbbell": "fitness_center",
    "edit": "edit",
    "eraser": "ink_eraser",
    "eye": "visibility",
    "eye-off": "visibility_off",
    "file": "description",
    "film": "movie",
    "filter": "filter_list",
    "flag": "flag",
    "flask": "science",
    "folder": "folder",
    "folder-plus": "create_new_folder",
    "forward": "drive_file_move",
    "fuel": "local_gas_station",
    "fullscreen-enter": "fullscreen",
    "fullscreen-exit": "fullscreen_exit",
    "gear": "settings",
    "gift": "redeem",
    "grid": "grid_view",
    "hard-drive": "hard_drive",
    "hash": "tag",
    "heart": "favorite",
    "highlighter": "ink_highlighter",
    "home": "home",
    "image": "image",
    "inbox": "inbox",
    "info": "info",
    "key": "key",
    "keyboard": "keyboard",
    "lasso": "lasso_select",
    "layers": "layers",
    "library": "folder_open",
    "leaf": "eco",
    "link": "link",
    "list-ul": "format_list_bulleted",
    "lock-closed": "lock",
    "lock-open": "lock_open",
    "mail": "mail",
    "map-pin": "location_on",
    "marker": "ink_marker",
    "menu": "menu",
    "mic": "mic",
    "monitor": "monitor",
    "moon": "dark_mode",
    "more": "more_horiz",
    "music": "music_note",
    "nib": "ink_pen",
    "note": "sticky_note_2",
    "palette": "palette",
    "panel-right": "right_panel_open",
    "paste": "content_paste",
    "paw": "pets",
    "pen": "edit",
    "pencil": "edit",
    "pill": "medication",
    "pin": "push_pin",
    "plane": "flight",
    "play": "play_arrow",
    "plus": "add",
    "quote": "format_quote",
    "receipt": "receipt_long",
    "redo": "redo",
    "route": "route",
    "school": "school",
    "search": "search",
    "send": "send",
    "shapes": "shapes",
    "share": "ios_share",
    "shield": "shield",
    "shield-check": "verified_user",
    "sidebar": "left_panel_open",
    "snippet": "text_snippet",
    "sparkle": "auto_awesome",
    "star": "star",
    "sun": "light_mode",
    "tag": "sell",
    "timeline": "timeline",
    "timer": "timer",
    "trash": "delete",
    "type": "title",
    "undo": "undo",
    "unlink": "link_off",
    "unread": "mark_email_unread",
    "upload": "upload",
    "user": "person",
    "users": "group",
    "utensils": "restaurant",
    "vault": "shield_lock",
    "wallet": "account_balance_wallet",
    "wand": "auto_fix_high",
    "wrench": "build",
    "zoom-in": "zoom_in",
    "zoom-out": "zoom_out"
  };

  const SVG = "http://www.w3.org/2000/svg";
  const cls = (extra) => "ms icon" + (extra ? " " + extra : "");

  function html(name, extra) {
    const m = MAP[name];
    if (m) return '<i class="' + cls(extra) + '" data-ms="' + m + '" aria-hidden="true"></i>';
    return '<svg class="icon' + (extra ? " " + extra : "") + '"><use href="#icon-' + name + '"></use></svg>';
  }

  function el(name, extra) {
    const m = MAP[name];
    if (m) {
      const s = document.createElement("i");
      s.className = cls(extra);
      s.dataset.ms = m;
      s.setAttribute("aria-hidden", "true");
      return s;
    }
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "icon" + (extra ? " " + extra : ""));
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(SVG, "use");
    use.setAttribute("href", "#icon-" + name);
    svg.append(use);
    return svg;
  }

  // The icons written straight into the page (the sidebar, settings, headers).
  function upgrade(root) {
    (root || document).querySelectorAll("svg.icon > use[href^='#icon-']").forEach((use) => {
      const name = use.getAttribute("href").slice(6);
      if (!MAP[name]) return;
      const svg = use.parentNode;
      const extra = [...svg.classList].filter((c) => c !== "icon").join(" ");
      const icon = el(name, extra);
      svg.replaceWith(icon);
    });
  }

  window.CPIcon = { html, el, upgrade, has: (name) => !!MAP[name] };
})();
