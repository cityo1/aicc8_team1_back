import axios from "axios";
import { parse } from "csv-parse/sync";

const defaultUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTQQQxJvSg13A2G_D_S833bONQv_S8t9Vls1nIuW5M9U1rX3R79h2N2_1wZ/pub?gid=0&single=true&output=csv";

async function test() {
    try {
        const response = await axios.get(defaultUrl);
        const csvData = response.data;
        const jsonData = parse(csvData, {
            columns: true,
            skip_empty_lines: true
        });
        console.log("Success!");
    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Data:", e.response.data);
        }
    }
}
test();
