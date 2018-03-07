class MessagesController < ApplicationController
  def create
    @message = Message.create(user_id: current_user.id, conversation_id: current_conversation.id, body: message_params[:body])
    MessageJob.perform_later('create', @message)
  end

  private

  def message
    @message ||= Message.find(params[:id])
  end

  def message_params
    params.require(:message).permit(:body)
  end
end
