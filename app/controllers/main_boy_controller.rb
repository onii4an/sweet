class MainBoyController < ApplicationController
  before_action :check_boy

  def index; end

  private

  def check_boy
    redirect_to root_path unless current_boy
    current_boy.update('in_a_conversation'=> false, 'waiting' => false)
  end
end
