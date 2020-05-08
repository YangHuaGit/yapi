const userModel = require('../models/user.js');
const yapi = require('../yapi.js');
const baseController = require('./base.js');
const common = require('../utils/commons.js');
const ldap = require('../utils/ldap.js');

const interfaceModel = require('../models/interface.js');
const groupModel = require('../models/group.js');
const projectModel = require('../models/project.js');
const avatarModel = require('../models/avatar.js');

const jwt = require('jsonwebtoken');

class ssoController extends baseController {
  constructor(ctx) {
    super(ctx);
    this.Model = yapi.getInst(userModel);
  }
  /**
   * 用户登录接口
   * @interface /user/login
   * @method POST
   * @category user
   * @foldnumber 10
   * @param {String} email email名称，不能为空
   * @param  {String} password 密码，不能为空
   * @returns {Object}
   * @example ./api/user/login.json
   */

  async sso(ctx) {
    //登录
    let userInst = yapi.getInst(userModel); //创建user实体
    let username = ctx.params.username
    let result = await userInst.findByUsername(username);

    if (!result) {
      try {
        let login = await this.handleThirdLogin(username);
        if (login === true) {
          yapi.commons.log('login success');
          ctx.redirect('/group');
        }
      } catch (e) {
        yapi.commons.log(e.message, 'error');
        ctx.redirect('/');
      }
    }else {
      this.setLoginCookie(result._id, result.passsalt);
      ctx.redirect('/group');
    }



  }


  async loginByToken(ctx) {
    try {
      let ret = await yapi.emitHook('third_login', ctx);
      let login = await this.handleThirdLogin(ret.email, ret.username);
      if (login === true) {
        yapi.commons.log('login success');
        ctx.redirect('/group');
      }
    } catch (e) {
      yapi.commons.log(e.message, 'error');
      ctx.redirect('/');
    }
  }


  // 处理第三方登录
  async handleThirdLogin(username) {
    let user, data, passsalt;
    let userInst = yapi.getInst(userModel);
    let email =  username + '@App.com'
    try {
      user = await userInst.findByUsername(username);

      // 新建用户信息
      if (!user || !user._id) {
        // passsalt = yapi.commons.randStr();
        passsalt = "111111";
        data = {
          username: username,
          password: yapi.commons.generatePassword(passsalt, passsalt),
          email: email,
          passsalt: passsalt,
          role: 'member',
          add_time: yapi.commons.time(),
          up_time: yapi.commons.time(),
          type: 'third'
        };
        user = await userInst.save(data);
        await this.handlePrivateGroup(user._id, username, email);
        // yapi.commons.sendMail({
        //   to: email,
        //   contents: `<h3>亲爱的用户：</h3><p>您好，感谢使用YApi平台，你的邮箱账号是：${email}</p>`
        // });
      }

      this.setLoginCookie(user._id, user.passsalt);
      return true;
    } catch (e) {
      console.error('third_login:', e.message); // eslint-disable-line
      throw new Error(`third_login: ${e.message}`);
    }
  }



  async handlePrivateGroup(uid) {
    var groupInst = yapi.getInst(groupModel);
    await groupInst.save({
      uid: uid,
      group_name: 'User-' + uid,
      add_time: yapi.commons.time(),
      up_time: yapi.commons.time(),
      type: 'private'
    });
  }

  setLoginCookie(uid, passsalt) {
    let token = jwt.sign({ uid: uid }, passsalt, { expiresIn: '7 days' });

    this.ctx.cookies.set('_yapi_token', token, {
      expires: yapi.commons.expireDate(7),
      httpOnly: true
    });
    this.ctx.cookies.set('_yapi_uid', uid, {
      expires: yapi.commons.expireDate(7),
      httpOnly: true
    });

    // this.ctx.cookies.set('_yapi_token', token, {
    //   expires: yapi.commons.expireDate(7),
    //   httpOnly: false
    // });
    // this.ctx.cookies.set('_yapi_uid', uid, {
    //   expires: yapi.commons.expireDate(7),
    //   httpOnly: false
    // });
  }




}

module.exports = ssoController  ;
