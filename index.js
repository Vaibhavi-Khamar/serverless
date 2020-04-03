const AWS = require('aws-sdk');
const ses = new AWS.SES();
const dynamoDB = new AWS.DynamoDB();
const route53 = new AWS.Route53();

var creds = new AWS.Credentials({ accessKeyId: process.env.aws_access_key, secretAccessKey: process.env.aws_secret_key });
AWS.config.credentials = creds;

exports.handler = (event, context) => {
    console.log('Received event:', JSON.stringify(event, null, 4));
    const datam = JSON.parse(event.Records[0].Sns.Message);
    console.log('Message received from SNS:', datam);
    const details = JSON.parse(datam);
    console.log('details :', details);
    const temp = details.bills;
    console.log('temp :', temp);
    const userdata = JSON.parse(temp);
    console.log('userdata :', userdata);
    console.log('useremailid :', userdata[0].email);
    const email = userdata[0].email;
    console.log('email id :', email);
    console.log('Email id:', JSON.stringify(email));

    let billList = [];

    const getItemObject = {
        TableName: 'csye6225',
        Key: { 'email': { S: email } }
    };

    dynamoDB.getItem(getItemObject, (err, data) => {
        console.log('err ', err)
        console.log('data ', data)
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

                userdata.forEach(element => billList.push(" \n http://" + domainName + "/v1/bill/" + element.id + "\n"));
                let links = billList.toString();
                console.log('Bill Links:', links);

                const emailObject = {
                    Destination: { ToAddresses: [email] },
                    Message: {
                        Body: { Text: { Data: "Please click on below links to view bill dues: \n " + links } },
                        Subject: { Data: "Requested bill dues" }
                    },
                    Source: "duebills@" + domainName
                };
                ses.sendEmail(emailObject, (err, data) => {
                    if (err) {
                        console.log(err.message);
                    } else {
                        console.log("Email sent! Message ID is: ", data.MessageId);
                    }
                });
            });
        }
    });
}