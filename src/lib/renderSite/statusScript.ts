/** The open-now line and year from core/engine/preview/template/index.html.j2, verbatim. */
export function statusScript(hoursJson: string): string {
  return `(function () {
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
  var hours = ${hoursJson};
  if (!hours) return;
  var keys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  var names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function mins(t) { var p = t.split(":"); return +p[0] * 60 + +p[1]; }
  function fmt(t) {
    var p = t.split(":"), h = +p[0], m = p[1], ap = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return h + (m === "00" ? "" : ":" + m) + " " + ap;
  }
  var now = new Date(), d = now.getDay(), cur = now.getHours() * 60 + now.getMinutes();
  var row = document.querySelector('tr[data-day="' + keys[d] + '"]');
  if (row) row.className = "today";
  var main, sub = "", today = hours[keys[d]];
  if (today && cur >= mins(today[0]) && cur < mins(today[1])) {
    main = "Open now until " + fmt(today[1]);
  } else if (today && cur < mins(today[0])) {
    main = "Opens today at " + fmt(today[0]);
    sub = "Closed right now";
  } else {
    for (var i = 1; i <= 7; i++) {
      var k = keys[(d + i) % 7];
      if (hours[k]) {
        main = "Opens " + (i === 1 ? "tomorrow" : names[(d + i) % 7]) + " at " + fmt(hours[k][0]);
        sub = "Closed right now";
        break;
      }
    }
  }
  if (!main) return;
  document.getElementById("status-main").textContent = main;
  document.getElementById("status-sub").textContent = sub;
  document.getElementById("status").hidden = false;
})();`;
}
