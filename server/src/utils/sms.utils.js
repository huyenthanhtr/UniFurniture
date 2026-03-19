const { Vonage } = require('@vonage/server-sdk');

const vonage = new Vonage({
    apiKey: process.env.VONAGE_API_KEY,
    apiSecret: process.env.VONAGE_API_SECRET
});

/**
 * Basic SMS sending (Current Implementation)
 */
async function sendOtpSms(toPhone, otp) {
    let toAreaCode = toPhone.trim();

    if (toAreaCode.startsWith('0')) {
        toAreaCode = '+84' + toAreaCode.substring(1);
    } else if (!toAreaCode.startsWith('+')) {
        if (toAreaCode.startsWith('84')) {
            toAreaCode = '+' + toAreaCode;
        } else {
            toAreaCode = '+84' + toAreaCode;
        }
    }

    const text = `Ma xac nhan dang ky UniFurniture cua ban la: ${otp}`;
    console.log("Final phone (SMS):", toAreaCode);

    try {
        const resp = await vonage.sms.send({
            to: toAreaCode,
            from: 'VonageAPI',
            text
        });

        console.log("Vonage SMS response:", JSON.stringify(resp, null, 2));

        if (resp.messages && resp.messages[0] && resp.messages[0].status === '0') {
            return true;
        }
        return false;
    } catch (err) {
        console.error('Error sending SMS:', err);
        return false;
    }
}

module.exports = { 
    sendOtpSms
};
