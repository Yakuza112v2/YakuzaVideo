async function mo(parameters, tokenIndex, showReasons) {
    try {
        const tokens = await lo(parameters.panelId, parameters.params);
        const token = tokens[tokenIndex];
        if (!token) {Va('YakuzaVideo', 'YouTube bietet diese Option für dieses Video gerade nicht an.'); return;}
        const response = await uo(token);
        const feedback = response && response.feedbackResponses && response.feedbackResponses[0];
        if (!feedback || feedback.isProcessed !== true) {
            Va('YakuzaVideo', 'YouTube hat die Rückmeldung nicht bestätigt. Bitte erneut versuchen.'); return;
        }
        po({signalAction: {signal: 'POPUP_BACK'}});
        Va('YakuzaVideo', ga('toasts.feedbackSent'));
        const dismissal = feedback.followUpDialog && feedback.followUpDialog.dismissalFollowUpRenderer;
        if (!showReasons || !dismissal || !Array.isArray(dismissal.reasons) || !dismissal.reasons.length) return;
        const buttons = dismissal.reasons.map(reason => Ha({title: bo(reason.title)}, null, [
            {signalAction: {signal: 'POPUP_BACK'}},
            {customAction: {action: 'FEEDBACK_REASON', parameters: {token: reason.token}}}
        ]));
        ja(bo(dismissal.dismissalReasonsPrompt), Wa(buttons), 'yv-feedback-reasons');
    } catch (error) {
        console.error('YakuzaVideo: video feedback failed', error);
        Va('YakuzaVideo', 'Das Videomenü konnte nicht geladen werden. Bitte erneut versuchen.');
    }
}
