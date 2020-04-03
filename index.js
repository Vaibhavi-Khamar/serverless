const AWS = require('aws-sdk');
const ses = new AWS.SES();
const dynamoDB = new AWS.DynamoDB();
const route53 = new AWS.Route53();

var creds = new AWS.Credentials({
    accessKeyId: process.env.aws_access_key, secretAccessKey: process.env.aws_secret_key
});

AWS.config.credentials = creds;

exports.handler = (event, context) => {
    console.log('Received event:', JSON.stringify(event, null, 4));
    const details = JSON.parse(event.Records[0].Sns.Message);
    console.log('Message received from SNS:', details);

    const email = details.billDue[0].email;
    console.log('Email:', JSON.stringify(email));
    let billList = [];

    const getItemObject = {
        TableName: 'csye6225',
        Key: {
            'email': { S: email }
        }
    };

    dynamoDB.getItem(getItemObject, (err, data) => {
        console.log('err ', err)
        console.log('DATA ',data)
        if (data.Item === undefined || data.Item.ttl.N < Math.floor(Date.now() / 1000)) {
            const putItemObject = {
                TableName: 'csye6225',
                Item: {
                    email: { S: email },
                    ttl: { N: (Math.floor(Date.now() / 1000) + 1800).toString() }
                }
            };
            dynamoDB.putItem(putItemObject, () => { });

            route53.listHostedZones({}, (err, data) => {

                let domainName = data.HostedZones[0].Name;
                domainName = domainName.substring(0, domainName.length - 1);

                details.forEach(element => billList.push(" \n https://" + domainName + "/v1/bills/due/" + element.numberOfDays + "\n"));
                let arr = billList.toString();
                console.log('Bills Links:', arr);

                const emailObject = {
                    Destination: {
                        ToAddresses: [email]
                    },
                    Message: {
                        Body: {
                            Text: {
                                Data: "Click below links to view due bills: \n " + arr
                            }
                        },
                        Subject: {
                            Data: "Bills Due Requested"
                        }
                    },
                    Source: "bills@"+  domainName
                };
                ses.sendEmail(emailObject, (err, data) => {
                    if (err) {
                        console.log(err.message);
                    } else {
                        console.log("Email sent! Message ID: ", data.MessageId);
                    }
                });
            });
        }
    });
};
