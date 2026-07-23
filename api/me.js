const { currentUser, publicUser } = require('./_auth');
module.exports = async (req, res) => {
  const u = await currentUser(req);
  res.status(200).json({ user: publicUser(u) });
};
