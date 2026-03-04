import userController from "./src/controllers/userController.js";
const { signup, login } = userController;
import dotenv from "dotenv";

dotenv.config();

async function test() {
    const email = 'test' + Date.now() + '@example.com';
    const password = 'password123';

    const signupReq = { body: { email, password, nickname: 'testuser' } };
    const loginReq = { body: { email, password } };

    const mockRes = () => {
        let code = 0;
        let data = null;
        return {
            status: function (c) { code = c; return this; },
            json: function (d) { data = d; return this; },
            cookie: function () { return this; },
            getCode: () => code,
            getData: () => data
        };
    };

    console.log("Starting signup test...");
    const res1 = mockRes();
    await signup(signupReq, res1);
    console.log("Signup Code:", res1.getCode());

    console.log("Starting login test...");
    const res2 = mockRes();
    await login(loginReq, res2);
    console.log("Login Code:", res2.getCode());
    console.log("Login Data:", JSON.stringify(res2.getData(), null, 2));
}

test();
