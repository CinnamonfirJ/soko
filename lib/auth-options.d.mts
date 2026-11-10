export declare const authPluginOptions: {
  otpLength: number;
  expiresIn: number;
  allowedAttempts: number;
  phoneNumberValidator: (phoneNumber: string) => boolean;
  signUpOnVerification: {
    getTempEmail: (phoneNumber: string) => string;
    getTempName: (phoneNumber: string) => string;
  };
};
