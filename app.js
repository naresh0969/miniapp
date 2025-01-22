const express = require('express');
const path = require('path');
const app = express();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const userModel = require('./models/user');
const postModel = require('./models/post');
const upload = require('./config/multerconfig');


// Middleware Setup
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());



app.get('/', (req, res) => {
  res.render('login');
});

app.get('/create', (req, res) => {
  res.render('index');
});

app.post('/register', async (req, res) => {
  let { name, password, username, age, email } = req.body;
  let user = await userModel.findOne({ email });
  if (user) {
    return res.redirect('/create'); 
  }

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, async (err, hash) => {
      let user = await userModel.create({
        username,
        name,
        password: hash,
        email,
        age
      });

      let token = jwt.sign({ email: email, userid: user._id }, "shhhh");
      res.cookie("token", token);

      res.redirect('/profile'); 
    });
  });
});

app.post('/', async (req, res) => {
  let { password, email } = req.body;
  let user1 = await userModel.findOne({ email });
  if (!user1) return res.status(500).send("Something is wrong!");

  bcrypt.compare(password, user1.password, async function (err, result) {
    if (result) {
      let token = jwt.sign({ email: email, userid: user1._id }, "shhhh");
      res.cookie("token", token);


      let user = await userModel.findOne({ email: email }).populate("posts");
      res.render('profile', { user });
      // res.status(200).send("you can login");
    } else {
      res.redirect('/');
    }
  });
});

app.get('/profile', isLoggedIn, async (req, res, next) => {
  console.log(req.user);
  let user = await userModel.findOne({ email: req.user.email }).populate("posts");
  res.render('profile', { user });
  next();
});

app.post('/post', isLoggedIn, async (req, res, next) => {
  let user = await userModel.findOne({ email: req.user.email });
  let { content } = req.body;
  let post = await postModel.create({
    user: user._id,
    content
  });
  user.posts.push(post._id);
  await user.save();
  user = await userModel.findOne({ email: req.user.email }).populate('posts');
  res.render('profile', { user });
});

app.get('/like/:id', isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");
  if (post.likes.indexOf(req.user.userid) === -1) {
    post.likes.push(req.user.userid);
  } else {
    post.likes.splice(post.likes.indexOf(req.user.userid), 1);
  }
  await post.save();
  res.redirect('/profile');
});

app.get('/edit/:id', isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");
  res.render('edit', { post });
});

app.post('/update/:id', isLoggedIn, async (req, res) => {
  let post = await postModel.findOneAndUpdate({ _id: req.params.id }, { content: req.body.content });
  res.redirect('/profile');
  res.render('edit', { post });
});

app.get('/profile/upload', (req, res) => {
  res.render('profileupload');
});

app.post('/upload', isLoggedIn, upload.single('image'), async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });
  user.profilepic = req.file.filename;
  await user.save();
  res.redirect('/profile');
});

app.get('/logout', (req, res) => {
  res.clearCookie("token");
  res.redirect('/');
});

function isLoggedIn(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect('/');
  } else {
    let data = jwt.verify(req.cookies.token, "shhhh");
    req.user = data;
    next();
  }
}

app.listen(3000);
