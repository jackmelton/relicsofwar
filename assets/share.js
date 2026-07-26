/* Share row behaviour — copy-to-clipboard and the phone-only native share
   sheet. The Facebook / X / Email buttons are plain links and need no script,
   so the row still works with JavaScript switched off; the two buttons this
   file drives ship hidden and are only revealed once we know they will work.

   Shared verbatim across the Historical Publications sites. Keep it dependency
   free — several of those sites are plain HTML uploaded over FTP. */
(function () {
  'use strict';

  var rows = document.querySelectorAll('[data-share]');
  if (!rows.length) return;

  Array.prototype.forEach.call(rows, function (row) {
    var url = row.getAttribute('data-share-url') || window.location.href;
    var title = row.getAttribute('data-share-title') || document.title;
    var status = row.querySelector('.share-status');

    function say(message) {
      if (status) status.textContent = message;
      window.setTimeout(function () {
        if (status) status.textContent = '';
      }, 3200);
    }

    /* Copy link. The modern clipboard API is tried first and an off-screen
       textarea is the fallback — older Safari, which a fair share of our
       readers are still on, has no navigator.clipboard on a plain click. */
    function legacyCopy(value) {
      var field = document.createElement('textarea');
      field.value = value;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.top = '-1000px';
      document.body.appendChild(field);
      field.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(field);
      return ok;
    }

    var copy = row.querySelector('.share-copy');
    if (copy) {
      copy.hidden = false;
      copy.addEventListener('click', function () {
        var text = copy.querySelector('.share-copy-text');
        var original = text ? text.textContent : '';

        function succeeded() {
          if (text) text.textContent = 'Copied';
          copy.classList.add('is-copied');
          say('Link copied to the clipboard.');
          window.setTimeout(function () {
            if (text) text.textContent = original;
            copy.classList.remove('is-copied');
          }, 2000);
        }
        function failed() {
          say('Could not copy the link automatically — the address is ' + url);
        }

        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(url).then(succeeded, function () {
            if (legacyCopy(url)) succeeded(); else failed();
          });
        } else if (legacyCopy(url)) {
          succeeded();
        } else {
          failed();
        }
      });
    }

    /* Native share sheet — phones and tablets only. On a desktop browser that
       supports it the sheet is a worse experience than the named buttons
       already sitting next to it, so it stays hidden there. */
    var native = row.querySelector('.share-native');
    var isTouch = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (native && navigator.share && isTouch) {
      native.hidden = false;
      native.addEventListener('click', function () {
        navigator.share({ title: title, url: url }).catch(function () {
          /* The visitor dismissed the sheet — nothing to report. */
        });
      });
    }
  });
})();
