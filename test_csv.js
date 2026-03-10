import axios from "axios";

const run = async () => {
    try {
        const response = await axios.get("https://docs.google.com/spreadsheets/d/e/2PACX-1vRdxK328L_8O9rzCzhV5tA5C8WduDrFQyngy2qR1eTQDYXd0GOvrmHZ5b0KfPMxFbNRH7RuZLuQ-iZd/pub?gid=1763039306&single=true&output=csv");
        const lines = response.data.split('\n');
        console.log("HEADER:", lines[0]);
    } catch (err) {
        console.error(err);
    }
}
run();
