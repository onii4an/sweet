class MessagesController < ApplicationController

  def create
    @message = current_user.messages.create(message_params)
    MessageJob.perform_later('create', @message)
  end

  private

  def message
    @message ||= Message.find(params[:id])
  end

  def message_params
    params.require(:message).permit(:body, :conversation_id)
  end
end
