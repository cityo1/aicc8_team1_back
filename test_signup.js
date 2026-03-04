import { createUser } from './src/models/userModel.js';
import { v4 as uuidv4 } from "uuid";

async function testSignup() {
    try {
        const res = await createUser(uuidv4(), "test1234@email.com", "hash", "testnick", "male", "10대", 188, 90, ["muscle"], ["gluten"]);
        console.log("Success:", res);
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}
testSignup();
