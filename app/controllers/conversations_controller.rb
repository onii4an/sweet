class ConversationsController < ApplicationController
  before_action :check_user
  helper_method :message
  helper_method :conversation_messages

  def show
    conversation
  end

  def conversation_messages
    Message.where(conversation_id: conversation.id).page params[:page]
  end

  def message
    @message ||= Message.new
  end

  def destroy

  end

  private

  def conversation
    @conversation = Conversation.find(params[:id])
  end

  def check_user
    redirect_to root_path unless conversation.boy_id == current_boy&.id || conversation.girl_id == current_girl&.id || current_admin
  end
end
