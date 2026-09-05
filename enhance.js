/*
 * Oracle enhancements - Courses link, first-visit guide, 3-question email capture.
 *
 * These sit on top of the deployed app bundle rather than inside it. The original
 * React source for this build was lost with the Manus workspace, so the app itself
 * cannot be recompiled; this file adds the three features without touching it.
 *
 * The email form posts to MailerLite's public embedded-form endpoint, which takes
 * no API key. An earlier attempt shipped an account API token in the browser
 * bundle, exposing it to every visitor. Never reintroduce a token here.
 */
(function () {
  'use strict';

  var COURSES_URL = 'https://veilcartography.gumroad.com/';
  var ML_ACCOUNT = '2511754';
  var ML_FORM = '193075706029147567';
  var ML_ENDPOINT = 'https://assets.mailerlite.com/jsonp/' + ML_ACCOUNT + '/forms/' + ML_FORM + '/subscribe';
  var QUESTION_LIMIT = 3;

  var K_VISIT = 'oracle_first_visit';
  var K_COUNT = 'oracle_question_count';
  var K_DONE = 'oracle_email_captured';

  // localStorage throws outright in some privacy modes, so every access is guarded.
  function get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  var css = [
    '.vc-courses{position:fixed;top:14px;right:16px;z-index:9000;font-family:Cinzel,Georgia,serif;',
    'font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#c9a45c;text-decoration:none;',
    'padding:8px 16px;border:1px solid rgba(201,164,92,.45);border-radius:2px;',
    'background:rgba(26,20,8,.72);backdrop-filter:blur(4px);transition:all .25s ease}',
    '.vc-courses:hover{color:#1a1408;background:#c9a45c;border-color:#c9a45c}',
    '.vc-overlay{position:fixed;inset:0;z-index:9500;display:flex;align-items:center;',
    'justify-content:center;padding:20px;background:rgba(10,8,3,.86);backdrop-filter:blur(3px)}',
    '.vc-modal{max-width:520px;width:100%;max-height:88vh;overflow-y:auto;background:#15100a;',
    'border:1px solid rgba(201,164,92,.4);border-radius:3px;padding:32px 28px;',
    'box-shadow:0 24px 60px rgba(0,0,0,.7);font-family:"EB Garamond",Georgia,serif;color:#e9dfc8}',
    '.vc-modal h2{font-family:Cinzel,Georgia,serif;font-size:23px;font-weight:600;color:#c9a45c;',
    'margin:0 0 6px;letter-spacing:.03em;line-height:1.3}',
    '.vc-rule{color:#c9a45c;text-align:center;letter-spacing:.5em;margin:0 0 18px;font-size:12px}',
    '.vc-modal p{font-size:17px;line-height:1.6;margin:0 0 16px}',
    '.vc-modal ul{list-style:none;padding:0;margin:0 0 22px}',
    '.vc-modal li{font-size:16px;line-height:1.55;margin:0 0 11px;padding-left:22px;position:relative}',
    '.vc-modal li:before{content:"\\2726";position:absolute;left:0;top:0;color:#c9a45c;font-size:12px}',
    '.vc-modal input{width:100%;box-sizing:border-box;background:rgba(233,223,200,.05);',
    'border:1px solid rgba(201,164,92,.35);border-radius:2px;padding:11px 13px;margin:0 0 12px;',
    'color:#e9dfc8;font-family:"EB Garamond",Georgia,serif;font-size:16px}',
    '.vc-modal input:focus{outline:none;border-color:#c9a45c}',
    '.vc-modal input::placeholder{color:rgba(233,223,200,.4)}',
    '.vc-btn{display:block;width:100%;box-sizing:border-box;cursor:pointer;',
    'font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.14em;text-transform:uppercase;',
    'padding:12px 18px;border-radius:2px;border:1px solid #c9a45c;background:#c9a45c;color:#1a1408;',
    'transition:all .25s ease}',
    '.vc-btn:hover{background:#dbb972;border-color:#dbb972}',
    '.vc-btn[disabled]{opacity:.55;cursor:default}',
    '.vc-btn-ghost{background:transparent;color:rgba(233,223,200,.65);border-color:transparent;',
    'margin-top:10px;letter-spacing:.1em}',
    '.vc-btn-ghost:hover{background:transparent;color:#c9a45c;border-color:transparent}',
    '.vc-msg{font-size:15px;line-height:1.5;margin:0 0 12px}',
    '.vc-msg.vc-err{color:#e0906a}',
    '.vc-note{margin:14px 0 0;text-align:center;font-size:14px;color:rgba(233,223,200,.5)}',
    '@media(max-width:520px){.vc-courses{top:10px;right:10px;font-size:11px;padding:7px 12px}',
    '.vc-modal{padding:26px 20px}.vc-modal h2{font-size:20px}}'
  ].join('');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- Courses link ---------- */
  var courses = document.createElement('a');
  courses.className = 'vc-courses';
  courses.href = COURSES_URL;
  courses.target = '_blank';
  courses.rel = 'noopener';
  courses.textContent = 'Courses';
  document.body.appendChild(courses);

  /* ---------- modal plumbing ---------- */
  //
  // The email gate is a hard wall: once it is up, the only way past it is to
  // subscribe. `dismissable` is false for that one, which drops the Escape key
  // handler and leaves nothing on the page that removes the overlay.
  var openOverlay = null;
  var openDismissable = true;

  function onEsc(e) { if (e.key === 'Escape' && openDismissable) closeModal(); }

  function closeModal() {
    if (openOverlay && openOverlay.parentNode) openOverlay.parentNode.removeChild(openOverlay);
    openOverlay = null;
    document.removeEventListener('keydown', onEsc, true);
  }

  function showModal(dismissable, buildInner) {
    if (openOverlay) return;
    var overlay = document.createElement('div');
    overlay.className = 'vc-overlay';
    var modal = document.createElement('div');
    modal.className = 'vc-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    overlay.appendChild(modal);
    buildInner(modal);
    document.body.appendChild(overlay);
    openOverlay = overlay;
    openDismissable = dismissable;
    document.addEventListener('keydown', onEsc, true);
  }

  /* ---------- first-visit guide ---------- */
  function showWelcome() {
    showModal(true, function (m) {
      m.innerHTML = [
        '<div class="vc-rule">&#10022;</div>',
        '<h2>Welcome to the Oracle</h2>',
        '<p>Four things worth knowing before you begin.</p>',
        '<ul>',
        '<li>Ask anything about the Gnostic Gospels &mdash; Sophia, the Demiurge, gnosis, the Archons. Plain questions work best.</li>',
        '<li>Answers are drawn from the Nag Hammadi library, with the source text named so you can read further.</li>',
        '<li>Tap a suggested question to fill the box, then edit it before you send.</li>',
        '<li>Press Enter to ask. Shift and Enter together start a new line.</li>',
        '</ul>'
      ].join('');
      var go = document.createElement('button');
      go.className = 'vc-btn';
      go.textContent = 'Begin';
      go.onclick = closeModal;
      m.appendChild(go);
      go.focus();
    });
    set(K_VISIT, 'seen');
  }

  /* ---------- email capture ---------- */
  function showEmailCapture() {
    showModal(false, function (m) {
      m.innerHTML = [
        '<div class="vc-rule">&#10022;</div>',
        '<h2>Continue Your Journey</h2>',
        '<p>You have asked three questions. Join the Oracle Circle to keep asking &mdash; it is free, and it is the only way on from here.</p>',
        '<ul>',
        '<li>Unlimited questions of the Oracle.</li>',
        '<li>A free eight-part course on Gnostic practice for beginners.</li>',
        '<li>Readings from the Nag Hammadi texts, set in context.</li>',
        '<li>No more than one email a week. Leave whenever you like.</li>',
        '</ul>'
      ].join('');

      var msg = document.createElement('p');
      msg.className = 'vc-msg';

      var form = document.createElement('form');
      var name = document.createElement('input');
      name.type = 'text';
      name.placeholder = 'Your name (optional)';
      name.autocomplete = 'name';

      var email = document.createElement('input');
      email.type = 'email';
      email.placeholder = 'Your email';
      email.required = true;
      email.autocomplete = 'email';

      var submit = document.createElement('button');
      submit.className = 'vc-btn';
      submit.type = 'submit';
      submit.textContent = 'Join the Oracle Circle';

      var note = document.createElement('p');
      note.className = 'vc-msg vc-note';
      note.textContent = 'Your address is used for the course and nothing else.';

      form.appendChild(name);
      form.appendChild(email);
      form.appendChild(msg);
      form.appendChild(submit);
      form.appendChild(note);
      m.appendChild(form);

      form.onsubmit = function (e) {
        e.preventDefault();
        var addr = email.value.trim();
        if (!addr) {
          msg.className = 'vc-msg vc-err';
          msg.textContent = 'Please enter an email address.';
          return;
        }
        submit.disabled = true;
        submit.textContent = 'Sending...';
        msg.className = 'vc-msg';
        msg.textContent = '';

        var body = new URLSearchParams();
        body.append('fields[email]', addr);
        if (name.value.trim()) body.append('fields[name]', name.value.trim());
        body.append('ml-submit', '1');
        body.append('anticsrf', 'true');

        fetch(ML_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString()
        })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d && d.success) {
              set(K_DONE, '1');
              // Double opt-in is on for this form, so the subscriber is not on the
              // list until they click the confirmation link. Say so, or they wait
              // for a welcome email that never arrives.
              m.innerHTML = [
                '<div class="vc-rule">&#10022;</div>',
                '<h2>One step left</h2>',
                '<p>Check your inbox and click the confirmation link. The first part of the course follows straight after.</p>'
              ].join('');
              var done = document.createElement('button');
              done.className = 'vc-btn';
              done.textContent = 'Return to the Oracle';
              done.onclick = closeModal;
              m.appendChild(done);
              done.focus();
            } else {
              var err = 'That did not go through. Please try again.';
              try {
                var fields = d.errors.fields;
                err = fields[Object.keys(fields)[0]][0];
              } catch (ex) { /* keep the generic message */ }
              msg.className = 'vc-msg vc-err';
              msg.textContent = err;
              submit.disabled = false;
              submit.textContent = 'Join the Oracle Circle';
            }
          })
          .catch(function () {
            msg.className = 'vc-msg vc-err';
            msg.textContent = 'No connection. Please try again in a moment.';
            submit.disabled = false;
            submit.textContent = 'Join the Oracle Circle';
          });
      };

      email.focus();
    });
  }

  /* ---------- question counter ---------- */
  //
  // The app handles Enter itself with a keydown handler and never fires a real
  // submit event, while the SEEK button does fire one. Both paths are watched, and
  // a short window drops the duplicate if one question ever triggers both.
  var lastCount = 0;

  function countQuestion() {
    var now = Date.now();
    if (now - lastCount < 600) return;
    lastCount = now;

    var n = parseInt(get(K_COUNT) || '0', 10) + 1;
    set(K_COUNT, String(n));

    if (n >= QUESTION_LIMIT && !get(K_DONE)) {
      // Let the third answer start rendering before the wall covers it, so the
      // reader gets what they asked for and then meets the gate.
      setTimeout(showEmailCapture, 1400);
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.shiftKey) return;
    var t = e.target;
    if (!t || t.id !== 'oracle-question') return;
    if (!t.value || !t.value.trim()) return;
    countQuestion();
  }, true);

  document.addEventListener('submit', function (e) {
    var f = e.target;
    var ask = f && f.querySelector ? f.querySelector('#oracle-question') : null;
    if (!ask || !ask.value || !ask.value.trim()) return;
    countQuestion();
  }, true);

  /* ---------- on load ---------- */
  if (parseInt(get(K_COUNT) || '0', 10) >= QUESTION_LIMIT && !get(K_DONE)) {
    // Reloading is not a way round the wall. A walled reader meets it again
    // before they can ask anything, not after one more free question.
    setTimeout(showEmailCapture, 900);
  } else if (!get(K_VISIT)) {
    // Wait for the app to paint so the guide lands over a finished page.
    setTimeout(showWelcome, 900);
  }
})();
