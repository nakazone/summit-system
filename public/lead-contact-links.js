/**
 * Native tel:/sms:/mailto links and stage-based message templates for leads.
 * Email templates are tuned for Gmail on phone/tablet (mailto: opens the compose screen).
 */
(function (global) {
  const SMS_COMPANY = 'Summit Flooring';
  const EMAIL_FROM_LABEL = 'Summit Flooring';
  const EMAIL_CONTACT = 'contact@summit-flooring.com';
  const EMAIL_WEBSITE = 'https://summitflooring.com';

  /** Appended to every email body — personalized when CRM user is loaded. */
  const EMAIL_SIGNATURE_FALLBACK =
    '\n\nBest regards,\n' +
    EMAIL_FROM_LABEL +
    '\n' +
    EMAIL_CONTACT +
    '\n' +
    EMAIL_WEBSITE;

  const ROLE_SIGNATURE_TITLES = {
    admin: 'Summit Flooring',
    sales_rep: 'Sales Consultant',
    sales: 'Sales Consultant',
    project_manager: 'Project Manager',
    manager: 'Manager',
    support: 'Customer Support',
    operational: 'Operations',
    user: 'Summit Flooring Team',
  };

  let crmEmailUserCache = null;
  let crmEmailUserPromise = null;

  function setCrmEmailUser(user) {
    if (user && typeof user === 'object') {
      crmEmailUserCache = {
        id: user.id,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        role: user.role || '',
      };
      try {
        global.sfCrmSessionUser = crmEmailUserCache;
      } catch (_) {}
    }
  }

  function getCrmEmailUser() {
    if (crmEmailUserCache) return crmEmailUserCache;
    if (global.sfCrmSessionUser && typeof global.sfCrmSessionUser === 'object') {
      setCrmEmailUser(global.sfCrmSessionUser);
      return crmEmailUserCache;
    }
    return null;
  }

  function loadCrmEmailUser() {
    const cached = getCrmEmailUser();
    if (cached) return Promise.resolve(cached);
    if (crmEmailUserPromise) return crmEmailUserPromise;
    crmEmailUserPromise = fetch('/api/auth/session', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.authenticated && data.user) setCrmEmailUser(data.user);
        return crmEmailUserCache;
      })
      .catch(() => null)
      .finally(() => {
        crmEmailUserPromise = null;
      });
    return crmEmailUserPromise;
  }

  function roleSignatureTitle(role) {
    const key = String(role || '')
      .trim()
      .toLowerCase();
    if (!key) return 'Summit Flooring Team';
    return ROLE_SIGNATURE_TITLES[key] || 'Summit Flooring Team';
  }

  function formatSignaturePhone(phone) {
    const raw = String(phone || '').trim();
    if (!raw) return '';
    if (typeof global.sfNormalizePhoneDigits === 'function') {
      const digits = global.sfNormalizePhoneDigits(raw).replace(/\D/g, '');
      if (digits.length === 10) {
        return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
      }
      if (digits.length === 11 && digits.charAt(0) === '1') {
        return (
          '(' +
          digits.slice(1, 4) +
          ') ' +
          digits.slice(4, 7) +
          '-' +
          digits.slice(7)
        );
      }
    }
    return raw;
  }

  function buildEmailSignature(user) {
    const u = user || getCrmEmailUser();
    if (!u || (!u.name && !u.email && !u.phone)) {
      return EMAIL_SIGNATURE_FALLBACK;
    }
    const lines = ['', 'Best regards,', ''];
    const name = String(u.name || '').trim();
    const title = roleSignatureTitle(u.role);
    const email = String(u.email || '').trim();
    const phone = formatSignaturePhone(u.phone);
    if (name) lines.push(name);
    if (title) lines.push(title);
    lines.push(EMAIL_FROM_LABEL);
    if (email) lines.push(email);
    else lines.push(EMAIL_CONTACT);
    if (phone) lines.push(phone);
    lines.push(EMAIL_WEBSITE);
    return lines.join('\n');
  }

  function getEmailSignature() {
    return buildEmailSignature(getCrmEmailUser());
  }

  function assetUrl(path) {
    const origin =
      global.location && global.location.origin ? String(global.location.origin).replace(/\/$/, '') : '';
    return origin + path;
  }

  function buildEmailSignatureHtml(user) {
    const u = user || getCrmEmailUser();
    const nameRaw = String(u?.name || '').trim() || EMAIL_FROM_LABEL;
    const name = escapeHtml(nameRaw);
    const title = escapeHtml(roleSignatureTitle(u?.role));
    const emailAddr = String(u?.email || '').trim() || EMAIL_CONTACT;
    const phone = formatSignaturePhone(u?.phone);
    const logoUrl = assetUrl('/assets/summitLogo.jpg');
    const phoneBlock = phone
      ? `<tr><td style="padding-top:3px;font-size:13px;line-height:1.45;"><a href="tel:${escapeAttr(
          normalizePhoneDigits(phone)
        )}" style="color:#1c1c1f;text-decoration:none;">${escapeHtml(phone)}</a></td></tr>`
      : '';
    return (
      '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0;font-family:Inter,Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#1c1c1f;max-width:440px;">' +
      '<tr><td style="padding:0 14px 0 0;vertical-align:top;">' +
      `<img src="${escapeAttr(logoUrl)}" alt="Summit Flooring" width="76" height="76" style="display:block;width:76px;height:76px;border-radius:10px;border:0;outline:none;" />` +
      '</td><td style="padding:0 0 0 14px;vertical-align:top;border-left:3px solid #d6c4a8;">' +
      `<div style="font-size:15px;font-weight:700;color:#1c1c1f;line-height:1.25;">${name}</div>` +
      `<div style="font-size:13px;color:#6b7280;margin-top:3px;line-height:1.3;">${title}</div>` +
      `<div style="font-size:13px;font-weight:600;color:#1c1c1f;margin-top:8px;line-height:1.3;">${escapeHtml(
        EMAIL_FROM_LABEL
      )}</div>` +
      '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top:6px;">' +
      `<tr><td style="font-size:13px;line-height:1.45;"><a href="mailto:${escapeAttr(
        emailAddr
      )}" style="color:#1c1c1f;text-decoration:none;">${escapeHtml(emailAddr)}</a></td></tr>` +
      phoneBlock +
      `<tr><td style="padding-top:3px;font-size:13px;line-height:1.45;"><a href="${escapeAttr(
        EMAIL_WEBSITE
      )}" style="color:#9a8458;text-decoration:none;font-weight:600;">summitflooring.com</a></td></tr>` +
      '</table></td></tr></table>'
    );
  }

  function buildEmailSignatureFallbackHtml() {
    const logoUrl = assetUrl('/assets/summitLogo.jpg');
    return (
      '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:14px;color:#1c1c1f;">' +
      '<tr><td style="padding-right:12px;vertical-align:top;">' +
      `<img src="${escapeAttr(logoUrl)}" alt="Summit Flooring" width="76" height="76" style="display:block;width:76px;height:76px;border-radius:10px;" />` +
      '</td><td style="vertical-align:top;border-left:3px solid #d6c4a8;padding-left:12px;">' +
      `<div style="font-weight:700;font-size:15px;">${escapeHtml(EMAIL_FROM_LABEL)}</div>` +
      `<div style="margin-top:6px;font-size:13px;"><a href="mailto:${escapeAttr(
        EMAIL_CONTACT
      )}" style="color:#1c1c1f;text-decoration:none;">${escapeHtml(EMAIL_CONTACT)}</a></div>` +
      `<div style="margin-top:3px;font-size:13px;"><a href="${escapeAttr(
        EMAIL_WEBSITE
      )}" style="color:#9a8458;text-decoration:none;font-weight:600;">summitflooring.com</a></div>` +
      '</td></tr></table>'
    );
  }

  function copyHtmlFallback(html, plain) {
    const div = document.createElement('div');
    div.contentEditable = 'true';
    div.innerHTML = html;
    div.setAttribute('aria-hidden', 'true');
    div.style.position = 'fixed';
    div.style.left = '-9999px';
    div.style.top = '0';
    document.body.appendChild(div);
    const range = document.createRange();
    range.selectNodeContents(div);
    const sel = global.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (_) {}
    document.body.removeChild(div);
    if (sel) sel.removeAllRanges();
    if (!ok && plain && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(plain).then(
        () => true,
        () => false
      );
    }
    return Promise.resolve(ok);
  }

  function copyRichEmailSignature(user) {
    const html = user ? buildEmailSignatureHtml(user) : buildEmailSignatureFallbackHtml();
    const plain = buildEmailSignature(user);
    if (navigator.clipboard && global.ClipboardItem) {
      return navigator.clipboard
        .write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plain], { type: 'text/plain' }),
          }),
        ])
        .then(() => true)
        .catch(() => copyHtmlFallback(html, plain));
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return copyHtmlFallback(html, plain);
    }
    return copyHtmlFallback(html, plain);
  }

  function notifyEmailSignatureCopied(copied) {
    if (typeof global.crmNotify !== 'function') return;
    global.crmNotify(
      copied
        ? 'Assinatura com logo copiada — cole no final do e-mail no Gmail.'
        : 'Abra o Gmail e use “Copiar assinatura” no menu Email.',
      copied ? 'success' : 'info'
    );
  }

  function launchLeadEmail(mailtoHref) {
    if (!mailtoHref) return;
    loadCrmEmailUser()
      .then(() => copyRichEmailSignature(getCrmEmailUser()))
      .then((copied) => {
        closeMessageChoiceMenu();
        notifyEmailSignatureCopied(copied);
        global.location.href = mailtoHref;
      })
      .catch(() => {
        closeMessageChoiceMenu();
        global.location.href = mailtoHref;
      });
  }

  function copyEmailSignatureOnly() {
    loadCrmEmailUser()
      .then(() => copyRichEmailSignature(getCrmEmailUser()))
      .then((copied) => {
        closeMessageChoiceMenu();
        notifyEmailSignatureCopied(copied);
      });
  }

  function wireEmailChoiceMenu(menu) {
    if (!menu) return;
    menu.querySelectorAll('[data-sf-email-mailto]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        launchLeadEmail(btn.getAttribute('data-sf-email-mailto'));
      });
    });
    const copyBtn = menu.querySelector('[data-sf-email-copy-sig]');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        copyEmailSignatureOnly();
      });
    }
  }

  const FOLLOW_UP_SMS = [
    {
      id: 'follow_up_quote_reminder',
      label: 'Follow up — quote reminder',
      template:
        "Hello [name], I hope all is well. Just following up on the quote I sent a few days ago. If everything looks good, I'd be happy to help get your project scheduled and reserve a spot for you.",
    },
    {
      id: 'follow_up_last_check',
      label: 'Follow up — last check-in',
      template:
        "Hello [name], just wanted to check in one last time regarding your flooring project. If timing is better later, no problem at all — I'd still be happy to help whenever you're ready.",
    },
  ];

  /** Quick-send email templates (shown for every stage). */
  const UNIVERSAL_EMAIL_TEMPLATES = [
    {
      id: 'email_intro',
      label: 'Email — thank you & intro',
      subject: 'Summit Flooring — your flooring project',
      template:
        'Hi [name],\n\nThank you for reaching out to Summit Flooring. We would love to help with your project.\n\nCould you share a few details?\n• Type of flooring or service\n• Approximate square footage\n• Your timeline\n\nReply to this email or call us — we will get back to you shortly.',
    },
    {
      id: 'email_schedule_visit',
      label: 'Email — schedule visit',
      subject: 'Summit Flooring — schedule a visit',
      template:
        'Hi [name],\n\nThank you for your interest in Summit Flooring.\n\nI would be happy to stop by for a free on-site estimate. What day and time works best for you this week?\n\nLooking forward to hearing from you.',
    },
    {
      id: 'email_follow_up',
      label: 'Email — gentle follow-up',
      subject: 'Following up — Summit Flooring',
      template:
        'Hi [name],\n\nI wanted to follow up on your flooring project and see if you had any questions.\n\nWhenever you are ready, we are here to help — no pressure at all.',
    },
  ];

  /** @type {Record<string, Array<{ id: string, label: string, subject: string, template: string }>>} */
  const STAGE_EMAIL_TEMPLATES = {
    new_lead: [
      {
        id: 'email_new_lead_welcome',
        label: 'Email — new inquiry reply',
        subject: 'Thanks for contacting Summit Flooring',
        template:
          'Hi [name],\n\nThanks for submitting your request — we received it and a member of our team will be in touch soon.\n\nIf you have photos of the space or a rough square footage, feel free to reply with them. It helps us prepare for your estimate.',
      },
    ],
    contacted: [
      {
        id: 'email_contacted_next_steps',
        label: 'Email — next steps',
        subject: 'Summit Flooring — next steps',
        template:
          'Hi [name],\n\nGreat connecting with you. As discussed, here are the next steps:\n\n1. Confirm your preferred date for an on-site visit\n2. We measure and review options on site\n3. You receive a detailed quote\n\nLet me know what works best for your schedule.',
      },
    ],
    meeting_scheduled: [
      {
        id: 'email_meeting_confirm',
        label: 'Email — confirm appointment',
        subject: 'Summit Flooring — appointment confirmation',
        template:
          'Hi [name],\n\nThis confirms your appointment with Summit Flooring. We look forward to meeting you and reviewing your project in person.\n\nIf anything changes, just reply to this email or give us a call.',
      },
    ],
    quote_sent: [
      {
        id: 'email_quote_sent',
        label: 'Email — quote sent',
        subject: 'Your Summit Flooring quote',
        template:
          'Hi [name],\n\nThank you for your time. Please find your quote attached / in the link we shared.\n\nIf you have questions about materials, timeline, or pricing, reply here — we are happy to walk through everything.\n\nLearn more about us: ' +
          EMAIL_WEBSITE,
      },
      {
        id: 'email_quote_follow_up',
        label: 'Email — quote follow-up',
        subject: 'Following up on your quote — Summit Flooring',
        template:
          'Hi [name],\n\nI hope you had a chance to review the quote we sent. If everything looks good, we can get your project on the schedule.\n\nLet me know if you would like to adjust anything or if you have questions.',
      },
    ],
    follow_up_1: [
      {
        id: 'email_follow_up_quote',
        label: 'Email — quote reminder',
        subject: 'Quick follow-up — Summit Flooring',
        template:
          'Hi [name],\n\nJust following up on the quote we sent. If the timing works, we would love to reserve a spot for your project.\n\nIf you need more time, no problem — reply when you are ready.',
      },
      {
        id: 'email_follow_up_last',
        label: 'Email — last check-in',
        subject: 'Checking in — Summit Flooring',
        template:
          'Hi [name],\n\nI wanted to check in one last time about your flooring project. If now is not the right time, we understand — feel free to reach out whenever you are ready.\n\nWe are always happy to help.',
      },
    ],
    won: [
      {
        id: 'email_won_thanks',
        label: 'Email — thank you (won)',
        subject: 'Thank you — Summit Flooring',
        template:
          'Hi [name],\n\nThank you for choosing Summit Flooring. We are excited to get started on your project.\n\nWe will be in touch shortly with scheduling details. If you need anything in the meantime, reply here.',
      },
    ],
  };

  /** @type {Record<string, Array<{ id: string, label: string, template: string }>>} */
  const STAGE_SMS_TEMPLATES = {
    new_lead: [
      {
        id: 'new_lead_intro',
        label: 'New lead — introduction',
        template:
          "Hi [name], thanks for reaching out to Summit Flooring. I'd be happy to help. Can you tell me a little about the project?",
      },
      ...FOLLOW_UP_SMS,
    ],
    quote_sent: [
      {
        id: 'quote_sent_followup',
        label: 'Quote sent — thank you',
        template:
          "Hello [name], thank you for your time today. I've sent email and attached the quote PDF with the options we discussed. Thank you!\n\nFor know more about us\nhttps://summitflooring.com/",
      },
    ],
    follow_up_1: FOLLOW_UP_SMS.slice(),
  };

  function escapeHtml(s) {
    if (s == null || s === '') return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  function normalizePhoneDigits(phone) {
    const raw = String(phone || '').trim();
    if (!raw) return '';
    const hasPlus = raw.startsWith('+');
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    return hasPlus ? '+' + digits : digits;
  }

  function isIosDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/i.test(ua)) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  }

  function leadFirstName(lead) {
    const full =
      lead && (lead.name || lead.full_name) ? String(lead.name || lead.full_name).trim() : '';
    return full.split(/\s+/).filter(Boolean)[0] || 'there';
  }

  function leadFullName(lead) {
    const full =
      lead && (lead.name || lead.full_name) ? String(lead.name || lead.full_name).trim() : '';
    return full || 'there';
  }

  function resolveLeadStageSlug(lead) {
    if (!lead) return '';
    const raw = String(lead.pipeline_stage_slug || lead.status || '').trim();
    if (typeof global.normalizePipelineSlug === 'function') {
      return global.normalizePipelineSlug(raw);
    }
    return raw;
  }

  function fillMessageTemplate(template, lead) {
    const first = leadFirstName(lead);
    const full = leadFullName(lead);
    return String(template)
      .replace(/\[first_name\]/gi, first)
      .replace(/\[full_name\]/gi, full)
      .replace(/\[name\]/gi, first);
  }

  function fillSmsTemplate(template, lead) {
    return fillMessageTemplate(template, lead);
  }

  function fillEmailTemplate(template, lead) {
    return fillMessageTemplate(template, lead);
  }

  function defaultLeadSmsBody(lead) {
    const first = leadFirstName(lead);
    return `Hi ${first}, this is ${SMS_COMPANY}. How can I help you today?`;
  }

  function getStageSmsDefinitions(slug) {
    return STAGE_SMS_TEMPLATES[slug] || null;
  }

  function leadMessageDefs(lead) {
    const slug = resolveLeadStageSlug(lead);
    const defs = getStageSmsDefinitions(slug);
    if (defs && defs.length) return { defs, filled: false };
    return {
      defs: [{ id: 'default', label: 'Message', template: defaultLeadSmsBody(lead) }],
      filled: true,
    };
  }

  /**
   * @param {object} lead
   * @returns {Array<{ id: string, label: string, body: string }>}
   */
  function getLeadMessageBodies(lead) {
    if (!lead) return [];
    const { defs, filled } = leadMessageDefs(lead);
    return defs.map((def) => ({
      id: def.id,
      label: def.label,
      body: filled ? defaultLeadSmsBody(lead) : fillSmsTemplate(def.template, lead),
    }));
  }

  /**
   * @param {object} lead
   * @returns {Array<{ id: string, label: string, body: string, href: string }>}
   */
  function getLeadSmsOptions(lead) {
    if (!lead || !lead.phone) return [];
    const phone = lead.phone;
    return getLeadMessageBodies(lead)
      .map((o) => ({
        ...o,
        href: buildSmsHref(phone, o.body),
      }))
      .filter((o) => o.href);
  }

  function defaultLeadEmailSubject(lead) {
    const first = leadFirstName(lead);
    return first && first !== 'there'
      ? `${EMAIL_FROM_LABEL} — ${first}`
      : `${EMAIL_FROM_LABEL} — your flooring project`;
  }

  function getStageEmailDefinitions(slug) {
    const stage = STAGE_EMAIL_TEMPLATES[slug] || [];
    const seen = new Set();
    const merged = [];
    [...UNIVERSAL_EMAIL_TEMPLATES, ...stage].forEach((def) => {
      if (seen.has(def.id)) return;
      seen.add(def.id);
      merged.push(def);
    });
    return merged;
  }

  function defaultLeadEmailBody(lead) {
    const def = UNIVERSAL_EMAIL_TEMPLATES[0];
    return fillEmailTemplate(def.template, lead) + '\n\nBest regards,\n';
  }

  /**
   * Message only — rich HTML signature is copied separately for Gmail paste.
   */
  function buildLeadEmailMessageBody(template, lead) {
    return fillEmailTemplate(template, lead) + '\n\nBest regards,\n';
  }

  /**
   * @param {object} lead
   * @returns {Array<{ id: string, label: string, subject: string, body: string }>}
   */
  function getLeadEmailBodies(lead) {
    if (!lead) return [];
    const slug = resolveLeadStageSlug(lead);
    const defs = getStageEmailDefinitions(slug);
    return defs.map((def) => ({
      id: def.id,
      label: def.label,
      subject: def.subject
        ? fillEmailTemplate(def.subject, lead)
        : defaultLeadEmailSubject(lead),
      body: buildLeadEmailMessageBody(def.template, lead),
    }));
  }

  /**
   * @param {object} lead
   * @returns {Array<{ id: string, label: string, body: string, href: string, subject: string }>}
   */
  function getLeadEmailOptions(lead) {
    const email = lead && lead.email != null ? String(lead.email).trim() : '';
    if (!email || !email.includes('@')) return [];
    return getLeadEmailBodies(lead)
      .map((o) => ({
        ...o,
        href: buildMailtoHref(email, o.subject, o.body),
      }))
      .filter((o) => o.href);
  }

  function buildMailtoHref(email, subject, body) {
    const addr = String(email || '').trim();
    if (!addr || !addr.includes('@')) return '';
    const q = [];
    if (subject != null && String(subject).trim()) {
      q.push('subject=' + encodeURIComponent(String(subject)));
    }
    if (body != null && String(body) !== '') {
      q.push('body=' + encodeURIComponent(String(body)));
    }
    return q.length ? `mailto:${addr}?${q.join('&')}` : `mailto:${addr}`;
  }

  function buildTelHref(phone) {
    const num = normalizePhoneDigits(phone);
    return num ? `tel:${num}` : '';
  }

  function buildSmsHref(phone, body) {
    const num = normalizePhoneDigits(phone);
    if (!num) return '';
    const encoded = encodeURIComponent(body != null ? String(body) : '');
    const sep = isIosDevice() ? '&' : '?';
    return `sms:${num}${sep}body=${encoded}`;
  }

  function buildLeadSmsHref(lead, body) {
    const phone = lead && lead.phone;
    if (!phone) return '';
    if (body != null) return buildSmsHref(phone, body);
    const opts = getLeadSmsOptions(lead);
    if (opts.length) return opts[0].href;
    return buildSmsHref(phone, defaultLeadSmsBody(lead));
  }

  function buildLeadMailtoHref(lead, body) {
    const email = lead && lead.email != null ? String(lead.email).trim() : '';
    if (!email) return '';
    const subject = defaultLeadEmailSubject(lead);
    if (body != null) return buildMailtoHref(email, subject, body);
    const opts = getLeadEmailOptions(lead);
    if (opts.length) return opts[0].href;
    return buildMailtoHref(email, subject, defaultLeadEmailBody(lead));
  }

  let choiceMenuEl = null;

  function closeMessageChoiceMenu() {
    if (choiceMenuEl && choiceMenuEl.parentNode) {
      choiceMenuEl.parentNode.removeChild(choiceMenuEl);
    }
    choiceMenuEl = null;
    document.removeEventListener('click', onChoiceMenuOutside, true);
    window.removeEventListener('resize', positionChoiceMenu);
  }

  function positionChoiceMenu() {
    if (!choiceMenuEl || !choiceMenuEl._anchor) return;
    const anchor = choiceMenuEl._anchor;
    const r = anchor.getBoundingClientRect();
    const margin = 8;
    const belowTop = r.bottom + 4;
    const maxH = Math.min(320, window.innerHeight - belowTop - margin);
    choiceMenuEl.style.position = 'fixed';
    choiceMenuEl.style.left =
      Math.max(margin, Math.min(r.left, window.innerWidth - margin - Math.max(r.width, 260))) + 'px';
    choiceMenuEl.style.top = belowTop + 'px';
    choiceMenuEl.style.width = Math.max(r.width, 260) + 'px';
    choiceMenuEl.style.maxHeight = Math.max(120, maxH) + 'px';
    choiceMenuEl.style.overflowY = 'auto';
    choiceMenuEl.style.zIndex = '25000';
  }

  function onChoiceMenuOutside(e) {
    if (
      choiceMenuEl &&
      (e.target.closest('#sfSmsChoiceMenu') ||
        e.target.closest('#sfEmailChoiceMenu') ||
        e.target.closest('[data-lqs-sms-menu]') ||
        e.target.closest('[data-lqs-email-menu]') ||
        e.target.closest('[data-sf-sms-picker-btn]') ||
        e.target.closest('[data-sf-email-picker-btn]'))
    ) {
      return;
    }
    closeMessageChoiceMenu();
  }

  function openMessageChoiceMenu(anchorEl, options, menuId) {
    if (!anchorEl || !options || !options.length) return;
    const isEmailMenu = menuId === 'sfEmailChoiceMenu';
    if (options.length === 1) {
      if (isEmailMenu) launchLeadEmail(options[0].href);
      else global.location.href = options[0].href;
      return;
    }
    closeMessageChoiceMenu();
    const menu = document.createElement('div');
    menu.id = menuId || 'sfSmsChoiceMenu';
    menu.className =
      'lead-quick-sheet__status-menu lead-quick-sheet__sms-menu' +
      (isEmailMenu ? ' lead-quick-sheet__email-menu' : '');
    menu.setAttribute('role', 'menu');
    const itemsHtml = options
      .map((o) => {
        const preview =
          o.body && isEmailMenu ? String(o.body).split('\n').find((line) => line.trim()) || '' : '';
        const sub =
          preview && preview.length > 72
            ? `<span class="lead-quick-sheet__sms-option-preview">${escapeHtml(preview.slice(0, 72) + '…')}</span>`
            : preview
              ? `<span class="lead-quick-sheet__sms-option-preview">${escapeHtml(preview)}</span>`
              : '';
        if (isEmailMenu) {
          return `<button type="button" class="lead-quick-sheet__status-option lead-quick-sheet__sms-option" role="menuitem" data-sf-email-mailto="${escapeAttr(
            o.href
          )}">${escapeHtml(o.label)}${sub}</button>`;
        }
        return `<a class="lead-quick-sheet__status-option lead-quick-sheet__sms-option" role="menuitem" href="${escapeAttr(
          o.href
        )}">${escapeHtml(o.label)}${sub}</a>`;
      })
      .join('');
    menu.innerHTML =
      itemsHtml +
      (isEmailMenu
        ? '<p class="sf-email-menu-hint">A assinatura com logo e copiada ao escolher um modelo — cole no Gmail apos abrir.</p>' +
          `<button type="button" class="lead-quick-sheet__status-option sf-email-copy-sig-btn" data-sf-email-copy-sig role="menuitem">Copiar assinatura com logo</button>`
        : '');
    menu._anchor = anchorEl;
    document.body.appendChild(menu);
    if (isEmailMenu) wireEmailChoiceMenu(menu);
    choiceMenuEl = menu;
    positionChoiceMenu();
    window.addEventListener('resize', positionChoiceMenu);
    requestAnimationFrame(() => {
      document.addEventListener('click', onChoiceMenuOutside, true);
    });
  }

  function openSmsChoiceMenu(anchorEl, lead) {
    if (!anchorEl || !lead) return;
    openMessageChoiceMenu(anchorEl, getLeadSmsOptions(lead), 'sfSmsChoiceMenu');
  }

  function openEmailChoiceMenu(anchorEl, lead) {
    if (!anchorEl || !lead) return;
    loadCrmEmailUser().finally(() => {
      openMessageChoiceMenu(anchorEl, getLeadEmailOptions(lead), 'sfEmailChoiceMenu');
    });
  }

  /**
   * @param {object} lead
   * @param {string} [buttonClass]
   * @param {object} [attrs] extra data-* attributes for picker button
   */
  function renderLeadSmsActionHtml(lead, buttonClass, attrs) {
    const opts = getLeadSmsOptions(lead);
    if (!opts.length) return '';
    const cls = buttonClass || 'lead-quick-sheet__action';
    if (opts.length === 1) {
      return `<a class="${cls}" href="${escapeAttr(opts[0].href)}">SMS</a>`;
    }
    const extra = attrs && typeof attrs === 'object' ? attrs : {};
    let dataAttrs = ' data-lqs-sms-menu data-sf-sms-picker-btn aria-haspopup="menu"';
    Object.keys(extra).forEach((k) => {
      dataAttrs += ` ${k}="${escapeAttr(extra[k])}"`;
    });
    return `<button type="button" class="${cls}"${dataAttrs}>SMS <span class="lead-quick-sheet__sms-chevron" aria-hidden="true">&#9662;</span></button>`;
  }

  function renderLeadEmailActionHtml(lead, buttonClass, attrs) {
    const opts = getLeadEmailOptions(lead);
    if (!opts.length) return '';
    const cls = buttonClass || 'lead-quick-sheet__action';
    const extra = attrs && typeof attrs === 'object' ? attrs : {};
    let dataAttrs = ' data-lqs-email-menu data-sf-email-picker-btn aria-haspopup="menu"';
    Object.keys(extra).forEach((k) => {
      dataAttrs += ` ${k}="${escapeAttr(extra[k])}"`;
    });
    return `<button type="button" class="${cls}"${dataAttrs}>Email <span class="lead-quick-sheet__sms-chevron" aria-hidden="true">&#9662;</span></button>`;
  }

  global.sfNormalizePhoneDigits = normalizePhoneDigits;
  global.sfDefaultLeadSmsBody = defaultLeadSmsBody;
  global.sfResolveLeadStageSlug = resolveLeadStageSlug;
  global.sfGetLeadMessageBodies = getLeadMessageBodies;
  global.sfGetLeadSmsOptions = getLeadSmsOptions;
  global.sfGetLeadEmailBodies = getLeadEmailBodies;
  global.sfDefaultLeadEmailBody = defaultLeadEmailBody;
  global.sfGetLeadEmailOptions = getLeadEmailOptions;
  global.sfGetStageEmailDefinitions = getStageEmailDefinitions;
  global.sfFillEmailTemplate = fillEmailTemplate;
  global.sfBuildEmailSignature = buildEmailSignature;
  global.sfBuildEmailSignatureHtml = buildEmailSignatureHtml;
  global.sfCopyRichEmailSignature = copyRichEmailSignature;
  global.sfLaunchLeadEmail = launchLeadEmail;
  global.sfSetCrmEmailUser = setCrmEmailUser;
  global.sfLoadCrmEmailUser = loadCrmEmailUser;
  global.sfGetStageSmsDefinitions = getStageSmsDefinitions;
  global.sfFillSmsTemplate = fillSmsTemplate;
  global.sfBuildTelHref = buildTelHref;
  global.sfBuildSmsHref = buildSmsHref;
  global.sfBuildMailtoHref = buildMailtoHref;
  global.sfBuildLeadSmsHref = buildLeadSmsHref;
  global.sfBuildLeadMailtoHref = buildLeadMailtoHref;
  global.sfRenderLeadSmsActionHtml = renderLeadSmsActionHtml;
  global.sfRenderLeadEmailActionHtml = renderLeadEmailActionHtml;
  global.sfOpenSmsChoiceMenu = openSmsChoiceMenu;
  global.sfOpenEmailChoiceMenu = openEmailChoiceMenu;
  global.sfCloseSmsChoiceMenu = closeMessageChoiceMenu;
  global.STAGE_SMS_TEMPLATES = STAGE_SMS_TEMPLATES;
  global.STAGE_EMAIL_TEMPLATES = STAGE_EMAIL_TEMPLATES;
  global.UNIVERSAL_EMAIL_TEMPLATES = UNIVERSAL_EMAIL_TEMPLATES;

  loadCrmEmailUser();
})(typeof window !== 'undefined' ? window : globalThis);
