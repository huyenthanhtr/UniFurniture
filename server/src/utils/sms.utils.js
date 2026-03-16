const { Vonage } = require('@vonage/server-sdk');

const vonage = new Vonage({
    apiKey: "dac273e1",
    apiSecret: process.env.VOYAGE_SECRECT
});

async function sendOtpSms(toPhone, otp) {
    const from = "Vonage APIs";
    // Format to 84 (Vietnam) if it starts with 0
    let toAreaCode = toPhone;
    if (toAreaCode.startsWith('0')) {
        toAreaCode = '84' + toAreaCode.substring(1);
    } else if (!toAreaCode.startsWith('84') && !toAreaCode.startsWith('+')) {
        toAreaCode = '84' + toAreaCode;
    }
    const to = toAreaCode.replace('+', ''); // Vonage expects no plus sign usually
    
    const text = `Ma xac nhan dang ky UniFurniture cua ban la: ${otp}`;

    try {
        const resp = await vonage.sms.send({ to, from, text });
        console.log('OTP SMS sent successfully:', resp);
        return true;
    } catch (err) {
        console.error('There was an error sending the OTP SMS:', err);
        return false;
    }
}

module.exports = {
    sendOtpSms
};
