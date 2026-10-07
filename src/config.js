module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_change_me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
  MAX_XP: 100000,
  MAX_LEVEL: 999,
  XP_PER_LEVEL: 100,

  BADGES: {
    basic:   { name:'Basic',   price:0,      member:false, level:1,   expiresDays:null },
    special: { name:'Special', price:17000,  member:true,  level:100, expiresDays:90 },
    silver:  { name:'Silver',  price:20000,  member:true,  level:50,  expiresDays:null },
    gold:    { name:'Gold',    price:50000,  member:true,  level:150, expiresDays:null },
    diamond: { name:'Diamond', price:200000, member:true,  level:400, expiresDays:null },
    star:    { name:'Star',    price:550000, member:true,  level:999, expiresDays:null }
  }
};
