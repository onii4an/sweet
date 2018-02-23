class ConversationController < ApplicationController
  before_action :check_user

  def index
    current_user.update('waiting' => true)
    if Boy.where(waiting: true, in_a_conversation: false).size > 0 && Girl.where(waiting: true, in_a_conversation: false).size > 0
      @offset_boy = rand(Boy.where(waiting: true).size)
      @boy_id = Boy.where(waiting: true).offset(@offset_boy).first.id
      @offset_girl = rand(Girl.where(waiting: true).size)
      @girl_id = Girl.where(waiting: true).offset(@offset_girl).first.id
      Conversation.create('boy_id' => @boy_id, 'girl_id' => @girl_id)
      ConversationJob.perform_later('create', [@boy_id, @girl_id, Conversation.where('boy_id' => @boy_id, 'girl_id' => @girl_id).last.id])
    end
  end

  def leave
    @conversation = Conversation.find(params[:id])
    @conversation.boy.update('in_a_conversation'=> false, 'waiting' => true)
    @conversation.girl.update('in_a_conversation'=> false, 'waiting' => true)
    redirect_to root_path
  end

  private

  def check_user
    redirect_to root_path unless current_user
  end
end
