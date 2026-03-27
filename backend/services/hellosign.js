/* ============================================
   VNK Automatisation Inc. - HelloSign Service
   ============================================ */

const Dropbox = require('@dropbox/sign');

// Initialize HelloSign client
let signatureClient = null;

function getSignatureClient() {
    if (!signatureClient && process.env.HELLOSIGN_API_KEY) {
        signatureClient = new Dropbox.SignatureRequestApi();
        signatureClient.username = process.env.HELLOSIGN_API_KEY;
    }
    return signatureClient;
}

// ---------- Send signature request ----------
async function sendSignatureRequest(contractData) {
    const client = getSignatureClient();

    if (!client) {
        console.warn('HelloSign not configured — signature request skipped');
        return { success: false, message: 'HelloSign not configured' };
    }

    try {
        const signingOptions = {
            draw: true,
            type: true,
            upload: true,
            phone: false,
            default_type: 'draw'
        };

        const signer = {
            email_address: contractData.clientEmail,
            name: contractData.clientName,
            order: 0
        };

        const data = {
            title: contractData.title || 'VNK Automatisation Inc. - Service Contract',
            subject: 'Please sign your VNK service contract',
            message: `Hello ${contractData.clientName}, please review and sign your service contract with VNK Automatisation Inc.`,
            signers: [signer],
            file_url: [contractData.documentUrl],
            signing_options: signingOptions,
            test_mode: process.env.NODE_ENV !== 'production'
        };

        const response = await client.signatureRequestSend({ signatureRequestSendRequest: data });

        return {
            success: true,
            signatureRequestId: response.body.signatureRequest.signatureRequestId,
            signingUrl: response.body.signatureRequest.signingUrl
        };

    } catch (error) {
        console.error('HelloSign error:', error);
        return { success: false, message: error.message };
    }
}

// ---------- Get signature status ----------
async function getSignatureStatus(signatureRequestId) {
    const client = getSignatureClient();

    if (!client) {
        return { success: false, message: 'HelloSign not configured' };
    }

    try {
        const response = await client.signatureRequestGet({ signatureRequestId });
        const request = response.body.signatureRequest;

        return {
            success: true,
            status: request.isComplete ? 'completed' : 'pending',
            isComplete: request.isComplete,
            signatures: request.signatures
        };

    } catch (error) {
        console.error('HelloSign status error:', error);
        return { success: false, message: error.message };
    }
}

// ---------- Download signed document ----------
async function downloadSignedDocument(signatureRequestId) {
    const client = getSignatureClient();

    if (!client) {
        return { success: false, message: 'HelloSign not configured' };
    }

    try {
        const response = await client.signatureRequestFiles({
            signatureRequestId,
            fileType: 'pdf'
        });

        return {
            success: true,
            fileBuffer: response.body
        };

    } catch (error) {
        console.error('HelloSign download error:', error);
        return { success: false, message: error.message };
    }
}

module.exports = {
    sendSignatureRequest,
    getSignatureStatus,
    downloadSignedDocument
};