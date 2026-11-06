/*
 * A built-in list of very common passwords (SEC-25). Most short ones are already refused by the
 * 12-character minimum; they stay on the list so it still works if the minimum changes.
 * Compared without regard to case.
 */
// prettier-ignore
const COMMON_PASSWORDS = new Set([
  '123456', '123456789', '12345678', '12345', '1234567', '1234567890', '123123', '111111',
  '000000', '654321', '666666', '121212', '112233', '159753', '987654321', 'password',
  'password1', 'password123', 'passw0rd', 'qwerty', 'qwerty123', 'qwertyuiop', 'abc123',
  'iloveyou', 'admin', 'admin123', 'welcome', 'welcome1', 'letmein', 'monkey', 'dragon',
  'football', 'baseball', 'princess', 'sunshine', 'master', 'shadow', 'superman', 'trustno1',
  'starwars', 'whatever', 'freedom', 'michael', 'charlie', 'login', 'hello', 'secret',
  'zaq12wsx', '1q2w3e4r', '1qaz2wsx', 'asdfghjkl', 'computer',
  '123456789012', '1234567890123', '12345678901234', '123412341234', '111111111111',
  '000000000000', '123123123123', '121212121212', '987654321098', '098765432109',
  'qwertyuiopas', 'qwertyuiop12', 'qwerty123456', 'qwertyqwerty', 'asdfghjklqwe',
  'asdfasdfasdf', 'aaaaaaaaaaaa', 'abcdefghijkl', 'abcabcabcabc', 'abcd12345678',
  'password1234', 'password12345', 'password123456', 'passwordpassword', 'mypassword123',
  'p@ssw0rd1234', 'passw0rd1234', 'iloveyou1234', 'iloveyouiloveyou', 'letmein12345',
  'welcome12345', 'welcome123456', 'admin1234567', 'administrator', 'changeme1234',
  'qazwsxedcrfv', '1q2w3e4r5t6y', '1qaz2wsx3edc', 'zaq1zaq1zaq1', 'q1w2e3r4t5y6',
  'football1234', 'baseball1234', 'sunshine1234', 'princess1234', 'superman1234',
  'starwars1234', 'monkey123456', 'dragon123456', 'trustno11234', 'correcthorsebatterystaple',
  'hesloheslo12', 'heslo1234567',
]);

/** @param {string} password */
export function isCommonPassword(password) {
  return COMMON_PASSWORDS.has(password.normalize('NFKC').toLowerCase());
}
