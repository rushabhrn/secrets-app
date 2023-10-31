//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy; // Check if this import path is correct
const findOrCreate = require('mongoose-findorcreate');

const app = express();

console.log(process.env.API_KEY);
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use(session({
  secret: "The fucking secret.",
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose
  .connect("mongodb://127.0.0.1:27017/userDB", { useNewUrlParser: true, useUnifiedTopology: true }) // Added useUnifiedTopology option
  .then(() => {
    console.log("MongoDB connected successfully.");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema); // Changed from 'new mongoose.model' to 'mongoose.model'

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) { // Removed User.serializeUser and User.deserializeUser
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id)
  .then(user => {
    done(null, user);
  })
  .catch(err => {
    done(err);
  });
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/secrets",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
},
function (accessToken, refreshToken, profile, cb) {
  console.log(profile);
  User.findOrCreate({ googleId: profile.id }, function (err, user) {
    return cb(err, user);
  });
}
));

app.post("/register", function (req, res) {
  User.register({ username: req.body.email }, req.body.password, function (err, user) { // Changed 'email' to 'username'
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/secrets");
      });
    }
  });
});

app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.email, // Changed 'email' to 'username'
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/secrets");
      });
    }
  });
});

app.get("/", function (req, res) {
  res.render("home");
});

app.get("/auth/google", function (req, res) {
  passport.authenticate("google", { scope: ["profile"] })(req, res); // Added missing (req, res)
});

app.get("/auth/google/secrets",
  passport.authenticate('google', { failureRedirect: '/login' }),
  function (req, res) {
    res.redirect("/secrets");
  });

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/register", function (req, res) {
  res.render("register");
});

app.get("/secrets", function (req, res) {
  User.find({ "secret": { $ne: null } })
  .then(foundUsers => {
    if (foundUsers) {
      res.render("secrets", { usersWithSecrets: foundUsers });
    }
  })
  .catch(err => {
    console.log(err);
    // Handle the error as needed
  });
});

app.get("/submit",function(req,res){
  if (req.isAuthenticated()){
    res.render("submit");
  }else{
    res.redirect("/login");
  }
});

app.post("/submit",function(req,res){
  const submittedSecret = req.body.secret;
  console.log(req.user.id);
  User.findById(req.user.id)
  .then(foundUser => {
    if (foundUser) {
      foundUser.secret = submittedSecret;
      return foundUser.save();
    } else {
      throw new Error("User not found");
    }
  })
  .then(() => {
    res.redirect("/secrets");
  })
  .catch(err => {
    console.log(err);
    // Handle the error as needed
  });
});

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

app.listen(3000, function () {
  console.log("Server started on port 3000.");
});
