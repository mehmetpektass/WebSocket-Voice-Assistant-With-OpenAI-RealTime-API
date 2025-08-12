export const emailTools = [
    {
        type: "function",
        name: "send_email",
        description: "Send a basic email with custom subject and content",
        parameters: {
            type: "object",
            properties: {
                to: {
                    type: "string",
                    description: "Recipient email address"
                },
                subject: {
                    type: "string",
                    description: "Email subject"
                },
                text: {
                    type: "string",
                    description: "Plain text content of the email"
                },
                html: {
                    type: "string",
                    description: "HTML content of the email (optional)"
                }
            },
            required: ["to", "subject", "text"]
        }
    },

    {
        type: "function",
        name: "send_template_email",
        description: "Send an email using a predefined professional template with full customization",
        parameters: {
            type: "object",
            properties: {
                to: {
                    type: "string",
                    description: "Recipient email address"
                },
                templateData: {
                    type: "object",
                    description: "Complete template data object with all customization options",
                    properties: {
                        title: {
                            type: "string",
                            description: "Email title/subject"
                        },
                        message: {
                            type: "string",
                            description: "Main message content for the template"
                        },
                        recipientName: {
                            type: "string",
                            description: "Name/title of the recipient (e.g., 'Sayın Müdür', 'John Doe') (optional)"
                        },
                        type: {
                            type: "string",
                            description: "Template type (e.g., 'question', 'info', 'urgent')",
                            enum: ["question", "info", "urgent", "business"]
                        },
                        additionalInfo: {
                            type: "string",
                            description: "Additional information with HTML formatting (e.g., budget, timeline, features with emojis and HTML tags) (optional)"
                        },
                        actionUrl: {
                            type: "string",
                            description: "URL for call-to-action button (optional)"
                        },
                        actionText: {
                            type: "string",
                            description: "Text for call-to-action button (optional)"
                        },
                        contactInfo: {
                            type: "string",
                            description: "Contact information with HTML formatting (phone, WhatsApp, email, etc.)"
                        },
                        closing: {
                            type: "string",
                            description: "Closing message/regards"
                        },
                        senderName: {
                            type: "string",
                            description: "Sender's name and title"
                        }
                    },
                    required: ["title", "message", "type", "contactInfo", "closing", "senderName"]
                }
            },
            required: ["to", "templateData"]
        }
    }
]


export async function handleSendEmail(args) {
    try {
        const response = await fetch(`http://localhost:4000/send`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: args.to,
                subject: args.subject,
                text: args.text,
                html: args.html
            })
        });

        return await response.json();

    } catch (error) {
        console.error('Send email failed:', error);
        return {
            success: false,
            message: `Email service error: ${error.message}`
        };
    }
}


export async function handleSendTemplateEmail(args) {
    try {
        const response = await fetch("http://localhost:4000/send-template", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: args.to,
                templateData: args.templateData
            })
        })

        return await response.json();

    } catch (error) {
        console.error('Send template email failed:', error);
        return {
            success: false,
            message: `Template email service error: ${error.message}`
        };
    }

}