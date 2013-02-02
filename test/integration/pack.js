// Load modules

var Chai = require('chai');
var Hapi = require('../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Pack', function () {

    var routesList = function (server) {

        var routes = server._routes['get'];
        var list = [];
        for (var i = 0, il = routes.length; i < il; ++i) {
            var route = routes[i];
            list.push(route.path);
        }

        return list;
    };

    it('registers plugins', function (done) {

        var server1 = new Hapi.Server();
        var server2 = new Hapi.Server({ tls: {} });
        var server3 = new Hapi.Server({ tls: {}, cache: 'memory' });
        var server4 = new Hapi.Server({ cache: 'memory' });

        var pack = new Hapi.Pack({ a: 1 });
        pack.addServer('s1', server1, ['a', 'b']);
        pack.addServer('s2', server2, ['a', 'c']);
        pack.addServer('s3', server3, ['a', 'b', 'd']);
        pack.addServer('s4', server4, ['b', 'x']);

        var plugin = {
            name: 'test',
            version: '1.0.0',
            hapi: {
                plugin: true,
                version: '0.x.x'
            },
            register: function (pack, next) {

                var a = this.select({ label: 'a' });
                var ab = a.select({ label: 'b' });
                var memoryx = pack.select({ labels: ['x', 'cache'] });
                var sodd = pack.select({ names: ['s2', 's4'] });

                expect(this.length).to.equal(4);
                expect(a.length).to.equal(3);
                expect(ab.length).to.equal(2);
                expect(memoryx.length).to.equal(1);
                expect(sodd.length).to.equal(2);

                this.addRoute({ method: 'GET', path: '/all', handler: function () { this.reply('all'); } });
                a.addRoute({ method: 'GET', path: '/a', handler: function () { this.reply('a'); } });
                ab.addRoutes([{ method: 'GET', path: '/ab', handler: function () { this.reply('ab'); } }]);
                memoryx.addRoute({ method: 'GET', path: '/memoryx', handler: function () { this.reply('memoryx'); } });
                sodd.addRoute({ method: 'GET', path: '/sodd', handler: function () { this.reply('sodd'); } });

                memoryx.addState('sid', { encoding: 'base64' });
                this.addHelper('test', function (next) {

                    next('123');
                });

                server3.helpers.test(function (result) {

                    expect(result).to.equal('123');
                    next();
                });
            }
        };

        pack.register(plugin, function (err) {

            expect(err).to.not.exist;

            expect(routesList(server1)).to.deep.equal(['/a', '/ab', '/all']);
            expect(routesList(server2)).to.deep.equal(['/a', '/all', '/sodd']);
            expect(routesList(server3)).to.deep.equal(['/a', '/ab', '/all']);
            expect(routesList(server4)).to.deep.equal(['/all', '/sodd', '/memoryx']);

            expect(server1.plugins.test.version).to.equal('1.0.0');

            done();
        });
    });

    it('requires plugin', function (done) {

        var server1 = new Hapi.Server();
        var server2 = new Hapi.Server({ tls: {} });
        var server3 = new Hapi.Server({ tls: {}, cache: 'memory' });
        var server4 = new Hapi.Server({ cache: 'memory' });

        var pack = new Hapi.Pack({ a: 1 });
        pack.addServer('s1', server1, ['a', 'b']);
        pack.addServer('s2', server2, ['a', 'test']);
        pack.addServer('s3', server3, ['a', 'b', 'd']);
        pack.addServer('s4', server4, ['b', 'test']);

        pack.require('./pack/test', function (err) {

            expect(err).to.not.exist;

            expect(server1._routes['get']).to.not.exist;
            expect(routesList(server2)).to.deep.equal(['/test']);
            expect(server3._routes['get']).to.not.exist;
            expect(routesList(server4)).to.deep.equal(['/test']);

            done();
        });
    });

    it('requires plugin via server plugin interface', function (done) {

        var plugin = {
            name: 'test',
            version: '1.0.0',
            hapi: {
                plugin: true,
                version: '0.x.x'
            },
            register: function (pack, next) {

                this.addRoute({ method: 'GET', path: '/a', handler: function () { this.reply('a'); } });
                next();
            }
        };

        var server = new Hapi.Server();
        server.plugin().register(plugin, function (err) {

            expect(err).to.not.exist;
            expect(routesList(server)).to.deep.equal(['/a']);

            expect(function () {

                server.plugin().register(plugin, function (err) { });
            }).to.throw();

            done();
        });
    });

    it('requires directory', function (done) {

        var server1 = new Hapi.Server();
        var server2 = new Hapi.Server({ tls: {} });
        var server3 = new Hapi.Server({ tls: {}, cache: 'memory' });
        var server4 = new Hapi.Server({ cache: 'memory' });

        var pack = new Hapi.Pack({ a: 1 });
        pack.addServer('s1', server1, ['a', 'b']);
        pack.addServer('s2', server2, ['a', 'test']);
        pack.addServer('s3', server3, ['a', 'b', 'd']);
        pack.addServer('s4', server4, ['b', 'test']);

        pack.requireDirectory('./pack', 'skip', function (err) {

            expect(err).to.not.exist;

            expect(server1._routes['get']).to.not.exist;
            expect(routesList(server2)).to.deep.equal(['/test']);
            expect(server3._routes['get']).to.not.exist;
            expect(routesList(server4)).to.deep.equal(['/test']);

            done();
        });
    });

    it('fails to require module with bad version requirements', function (done) {

        var server1 = new Hapi.Server();
        var pack = new Hapi.Pack({ a: 1 });
        pack.addServer('s1', server1, ['a', 'b']);

        pack.require('./pack/skip', function (err) {

            expect(err).to.exist;
            expect(err.message).to.equal('Incompatible hapi plugin version');
            done();
        });
    });

    it('fails to require missing module', function (done) {

        var server1 = new Hapi.Server();
        var pack = new Hapi.Pack({ a: 1 });
        pack.addServer('s1', server1, ['a', 'b']);

        pack.require('./pack/none', function (err) {

            expect(err).to.exist;
            expect(err.message).to.contain('Cannot find module');
            done();
        });
    });

    it('starts and stops', function (done) {

        var server1 = new Hapi.Server(0);
        var server2 = new Hapi.Server(0, { tls: {} });
        var server3 = new Hapi.Server(0, { tls: {}, cache: 'memory' });
        var server4 = new Hapi.Server(0, { cache: 'memory' });

        var pack = new Hapi.Pack({ a: 1 });
        pack.addServer('s1', server1, ['a', 'b']);
        pack.addServer('s2', server2, ['a', 'test']);
        pack.addServer('s3', server3, ['a', 'b', 'd']);
        pack.addServer('s4', server4, ['b', 'test']);

        pack.start(function () {

            expect(server1._started).to.equal(true);
            expect(server2._started).to.equal(true);
            expect(server3._started).to.equal(true);
            expect(server4._started).to.equal(true);

            pack.stop();

            expect(server1._started).to.equal(false);
            expect(server2._started).to.equal(false);
            expect(server3._started).to.equal(false);
            expect(server4._started).to.equal(false);

            done();
        });
    });

    it('invalidates not a plugin', function (done) {

        var pack = new Hapi.Pack({ a: 1 });
        var err = pack.validate({ name: 'test', version: '0.0.0', register: function (pack, next) { next(); } });

        expect(err).to.exist;
        expect(err.message).to.equal('Not a hapi plugin');
        done();
    });

    it('invalidates missing name', function (done) {

        var pack = new Hapi.Pack({ a: 1 });
        var err = pack.validate({ version: '0.0.0', hapi: { plugin: true }, register: function (pack, next) { next(); } });

        expect(err).to.exist;
        expect(err.message).to.equal('Plugin missing name');
        done();
    });

    it('invalidates missing version', function (done) {

        var pack = new Hapi.Pack({ a: 1 });
        var err = pack.validate({ name: 'test', hapi: { plugin: true }, register: function (pack, next) { next(); } });

        expect(err).to.exist;
        expect(err.message).to.equal('Plugin missing version');
        done();
    });

    it('invalidates missing register method', function (done) {

        var pack = new Hapi.Pack({ a: 1 });
        var err = pack.validate({ name: 'test', version: '0.0.0', hapi: { plugin: true } });

        expect(err).to.exist;
        expect(err.message).to.equal('Plugin missing register() method');
        done();
    });
});