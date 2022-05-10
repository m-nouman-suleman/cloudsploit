var async = require('async');
var helpers = require('../../../helpers/azure');

module.exports = {
    title: 'SSL Certificate Auto Renewal',
    category: 'Key Vaults',
    domain: 'Identity and Access Management',
    description: 'Ensures that Microsoft Azure Key Vault SSL certificates auto renewal is enabled.',
    more_info: 'Configure SSL certificates for auto renewal in order to prevent any application or service outage, credential leak, or process violation that can disrupt your business.',
    recommended_action: 'Ensure that Key Vault SSL certificates are configured to have auto renewal enabled.',
    link: 'https://docs.microsoft.com/en-us/azure/key-vault/certificates/overview-renew-certificate',
    apis: ['vaults:list', 'vaults:getCertificates', 'getCertificatePolicy:get'],

    run: function(cache, settings, callback) {
        var results = [];
        var source = {};
        var locations = helpers.locations(settings.govcloud);

        async.each(locations.vaults, function(location, rcb) {
            var vaults = helpers.addSource(cache, source,
                ['vaults', 'list', location]);

            if (!vaults) return rcb();

            if (vaults.err || !vaults.data) {
                helpers.addResult(results, 3, 'Unable to query for Key Vaults: ' + helpers.addError(vaults), location);
                return rcb();
            }

            if (!vaults.data.length) {
                helpers.addResult(results, 0, 'No Key Vaults found', location);
                return rcb();
            }

            vaults.data.forEach((vault) => {
                var certificates = helpers.addSource(cache, source,
                    ['vaults', 'getCertificates', location, vault.id]);

                if (!certificates || certificates.err || !certificates.data) {
                    helpers.addResult(results, 3, 'Unable to query for Key Vault certificates: ' + helpers.addError(certificates), location, vault.id);
                } else if (!certificates.data.length) {
                    helpers.addResult(results, 0, 'No Key Vault Certificates found', location, vault.id);
                } else {
                    certificates.data.forEach((certificate) => {
                        var certificatePolicy = helpers.addSource(cache, source,
                            ['getCertificatePolicy', 'get', location, certificate.id]);

                        if (!certificatePolicy || certificatePolicy.err || !certificatePolicy.data) {
                            helpers.addResult(results, 3, 'Unable to query for Certificate Policy: ' + helpers.addError(certificatePolicy), location, certificate.id);
                        } else {
                            let autoRenew = false;
                            const lifetimeActions = certificatePolicy.data.lifetime_actions;

                            lifetimeActions.forEach(({ action }) => {
                                if (action.action_type.toLowerCase() === 'autorenew') {
                                    autoRenew = true;
                                }
                            });

                            if (autoRenew) {
                                helpers.addResult(results, 0, 'SSL Certificate auto renewal is enabled', location, certificate.id);
                            } else {
                                helpers.addResult(results, 2, 'SSL Certificate auto renewal is not enabled', location, certificate.id);
                            }
                        }
                    });
                }
            });

            rcb();
        }, function() {
            callback(null, results, source);
        });
    }
};
