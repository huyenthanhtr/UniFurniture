const { Vonage } = require('@vonage/server-sdk');

const vonage = new Vonage({
    apiKey: "dac273e1",
    apiSecret: process.env.VOYAGE_SECRECT
});

async function sendOtpSms(toPhone, otp) {
    const from = "UniFurniture";
    const to = toPhone;
    const text = `Ma xac nhan dang ky UniFurniture cua ban la: ${otp}. Vui long khong chia se ma nay cho bat ky ai.`;

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
