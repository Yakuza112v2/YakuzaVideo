async function mo(parameters, tokenIndex, showReasons) {
    try {
        const dismissed = window.__yvDismissedVideos;
        const scopeKey = dismissed ? await dismissed.context() : null;
        const tokens = await lo(parameters.panelId, parameters.params);
        const token = tokens[tokenIndex];
        if (!token) {Va('YakuzaVideo', 'YouTube bietet diese Option für dieses Video gerade nicht an.'); return;}
        if (dismissed && await dismissed.context() !== scopeKey) {Va('YakuzaVideo', 'Das Profil wurde gewechselt. Bitte das Videomenü erneut öffnen.'); return;}
        const response = await uo(token);
        const feedback = response && response.feedbackResponses && response.feedbackResponses[0];
        if (!feedback || feedback.isProcessed !== true) {
            Va('YakuzaVideo', 'YouTube hat die Rückmeldung nicht bestätigt. Bitte erneut versuchen.'); return;
        }
        if (dismissed && parameters.videoId) {
            await dismissed.context();
            if (!dismissed.add(parameters.videoId, scopeKey)) Va('YakuzaVideo', 'YouTube hat die Rückmeldung erhalten. Dauerhaftes Ausblenden konnte nicht gespeichert werden.');
            dismissed.refresh(scopeKey);
        }
        po({signalAction: {signal: 'POPUP_BACK'}});
        Va('YakuzaVideo', ga('toasts.feedbackSent'));
        const dismissal = feedback.followUpDialog && feedback.followUpDialog.dismissalFollowUpRenderer;
        if (!showReasons || !dismissal || !Array.isArray(dismissal.reasons) || !dismissal.reasons.length) return;
        const buttons = [];
        for (const entry of dismissal.reasons) {
            const reason = entry.dismissalReasonTextRenderer || entry;
            const title = bo(reason.text || reason.title).trim();
            const token = so(reason.feedback) || reason.token;
            if (!title || typeof token !== 'string' || !token) continue;
            buttons.push(Ha({title}, null, [{customAction: {action: 'FEEDBACK_REASON', parameters: {token, videoId: parameters.videoId, scopeKey}}}]));
        }
        if (!buttons.length) return;
        const dialogId = 'yv-feedback-reasons-' + (window.__yvFeedbackReasonSequence = (window.__yvFeedbackReasonSequence || 0) + 1);
        ja(bo(dismissal.dismissalReasonsPrompt), Wa(buttons), dialogId);
    } catch (error) {
        console.error('YakuzaVideo: video feedback failed', error);
        Va('YakuzaVideo', 'Das Videomenü konnte nicht geladen werden. Bitte erneut versuchen.');
    }
}

async function yvSendFeedbackReason(parameters) {
    if (!parameters || typeof parameters.token !== 'string' || !parameters.token) return;
    try {
        const dismissed = window.__yvDismissedVideos;
        if (dismissed && parameters.scopeKey && await dismissed.context() !== parameters.scopeKey) {Va('YakuzaVideo', 'Das Profil wurde gewechselt. Bitte das Videomenü erneut öffnen.'); return;}
        const response = await uo(parameters.token);
        const feedback = response && response.feedbackResponses && response.feedbackResponses[0];
        if (!feedback || feedback.isProcessed !== true) {
            Va('YakuzaVideo', 'YouTube hat den Grund nicht bestätigt. Bitte erneut versuchen.'); return;
        }
        if (dismissed && parameters.videoId && parameters.scopeKey) {await dismissed.context(); dismissed.add(parameters.videoId, parameters.scopeKey); dismissed.refresh(parameters.scopeKey);}
        po({signalAction: {signal: 'POPUP_BACK'}});
        Va('YakuzaVideo', ga('toasts.feedbackSent'));
    } catch (error) {Va('YakuzaVideo', 'Der Grund konnte nicht gesendet werden. Bitte erneut versuchen.');}
}
