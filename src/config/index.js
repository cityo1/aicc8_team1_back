require('dotenv').config();

const config = {
    port: process.env.PORT || 3000,
    dbUri: process.env.MONGO_URI || 'mongodb://localhost:27017/test', // 사용할 DB에 맞게 수정
    // jwtSecret: process.env.JWT_SECRET || 'your_secret_key', // 나중에 인증 추가 시 사용
    // env: process.env.NODE_ENV || 'development',

};


module.exports = config;
