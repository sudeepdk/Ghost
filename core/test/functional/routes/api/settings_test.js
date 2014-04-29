/*global describe, it, before, after */
var supertest     = require('supertest'),
    express       = require('express'),
    should        = require('should'),
    _             = require('lodash'),
    testUtils     = require('../../../utils'),

    ghost         = require('../../../../../core'),

    httpServer,
    request,
    agent;


describe('Settings API', function () {
    var user = testUtils.DataGenerator.forModel.users[0],
        csrfToken = '';

    before(function (done) {
        var app = express();

        ghost({app: app}).then(function (_httpServer) {
            httpServer = _httpServer;
            // request = supertest(app);
            request = supertest.agent(app);

            testUtils.clearData()
                .then(function () {
                    return testUtils.initData();
                })
                .then(function () {
                    return testUtils.insertDefaultFixtures();
                })
                .then(function () {

                    request.get('/ghost/signin/')
                        .expect(200)
                        .end(function (err, res) {
                            if (err) {
                                return done(err);
                            }
                            var pattern_meta = /<meta.*?name="csrf-param".*?content="(.*?)".*?>/i;
                            pattern_meta.should.exist;
                            csrfToken = res.text.match(pattern_meta)[1];

                            process.nextTick(function() {
                                request.post('/ghost/signin/')
                                    .set('X-CSRF-Token', csrfToken)
                                    .send({email: user.email, password: user.password})
                                    .expect(200)
                                    .end(function (err, res) {
                                        if (err) {
                                            return done(err);
                                        }


                                        request.saveCookies(res);
                                        request.get('/ghost/')
                                            .expect(200)
                                            .end(function (err, res) {
                                                if (err) {
                                                    return done(err);
                                                }
                                                // console.log('/ghost/', err, res);
                                                csrfToken = res.text.match(pattern_meta)[1];
                                                done();
                                            });
                                    });

                            });

                        });
                }, done);
        }).otherwise(function (e) {
            console.log('Ghost Error: ', e);
            console.log(e.stack);
        });
    });

    after(function () {
        httpServer.close();
    });

    // TODO: currently includes values of type=core
    it('can retrieve all settings', function (done) {
        request.get(testUtils.API.getApiQuery('settings/'))
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                should.not.exist(res.headers['x-cache-invalidate']);
                res.should.be.json;
                var jsonResponse = res.body;
                jsonResponse.should.exist;

                testUtils.API.checkResponse(jsonResponse, 'settings');
                done();
            });
    });

    it('can retrieve a setting', function (done) {
        request.get(testUtils.API.getApiQuery('settings/title/'))
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                should.not.exist(res.headers['x-cache-invalidate']);
                res.should.be.json;
                var jsonResponse = res.body;

                jsonResponse.should.exist;
                testUtils.API.checkResponseValue(jsonResponse, ['key', 'value']);
                jsonResponse.key.should.eql('title');
                done();
            });
    });

    it('can\'t retrieve non existent setting', function (done) {
        request.get(testUtils.API.getApiQuery('settings/testsetting/'))
            .expect(404)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                should.not.exist(res.headers['x-cache-invalidate']);
                res.should.be.json;
                var jsonResponse = res.body;
                jsonResponse.should.exist;
                testUtils.API.checkResponseValue(jsonResponse, ['error']);
                done();
            });
    });

    it('can edit settings', function (done) {
        request.get(testUtils.API.getApiQuery('settings/'))
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                var jsonResponse = res.body,
                    changedValue = 'Ghost changed';
                jsonResponse.should.exist;
                jsonResponse.title = changedValue;

                request.put(testUtils.API.getApiQuery('settings/'))
                    .set('X-CSRF-Token', csrfToken)
                    .send(jsonResponse)
                    .expect(200)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }

                        var putBody = res.body;
                        res.headers['x-cache-invalidate'].should.eql('/*');
                        res.should.be.json;
                        putBody.should.exist;
                        putBody.title.should.eql(changedValue);
                        testUtils.API.checkResponse(putBody, 'settings');
                        done();
                    });
            });
    });

    it('can\'t edit settings with invalid CSRF token', function (done) {
        request.get(testUtils.API.getApiQuery('settings'))
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                var jsonResponse = res.body,
                    changedValue = 'Ghost changed';
                jsonResponse.should.exist;
                jsonResponse.title = changedValue;

                request.put(testUtils.API.getApiQuery('settings/'))
                    .set('X-CSRF-Token', 'invalid-token')
                    .send(jsonResponse)
                    .expect(403)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }

                        done();
                    });
            });
    });


    it('can\'t edit non existent setting', function (done) {
        request.get(testUtils.API.getApiQuery('settings'))
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                var jsonResponse = res.body,
                    newValue = 'new value';
                jsonResponse.should.exist;
                jsonResponse.testvalue = newValue;

                request.put(testUtils.API.getApiQuery('settings/'))
                    .set('X-CSRF-Token', csrfToken)
                    .send(jsonResponse)
                    .expect(404)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }

                        var putBody = res.body;
                        should.not.exist(res.headers['x-cache-invalidate']);
                        res.should.be.json;
                        testUtils.API.checkResponseValue(putBody, ['error']);
                        done();
                    });
            });
    });


});